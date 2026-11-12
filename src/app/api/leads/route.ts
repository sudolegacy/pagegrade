import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { emailSchema, limitOrThrow } from '@/lib/server/auth-flows';
import { createLead, recentLeadFrom } from '@/lib/server/leads';
import { mailer } from '@/lib/server/mail';
import { currentUser } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { SITE } from '@/lib/site';
import { UrlRejectedError, normalizeUrl, validatePublicUrl } from '@/lib/engine/net/url-guard';

export const dynamic = 'force-dynamic';

const MAX_PROSPECTS = 5;

const body = z.object({
  kind: z.enum(['pack', 'call', 'partner', 'other']).default('pack'),
  name: z.string().trim().max(80, 'Keep your name under 80 characters.').default(''),
  email: emailSchema,
  company: z.string().trim().max(120, 'Keep the agency name under 120 characters.').default(''),
  website: z.string().trim().max(300, 'That web address is too long.').default(''),
  // Blank entries are allowed and ignored, so an error can point at the right box.
  prospects: z.array(z.string().trim().max(2048, 'That web address is too long.')).max(10, `Send up to ${MAX_PROSPECTS} pages.`).default([]),
  message: z.string().trim().max(2000, 'Keep your message under 2,000 characters.').default(''),
  hp: z.string().max(200).optional(), // honeypot: people never see this field
});

type Checked = { index: number; url: string } | { index: number; problem: string };

const invalid = (field: string, message: string) => new HttpError(400, message, 'invalid', { field });
/** Single-line fields end up in an email subject, so no line breaks or control characters. */
const oneLine = (s: string) => s.replace(/[\p{Cc}\s]+/gu, ' ').trim();
const tidy = (s: string) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');

/** The page the form was on, for the pipeline view. */
function sourceOf(req: NextRequest): string {
  try {
    return new URL(req.headers.get('referer') ?? '').pathname.replace(/^\/+|\/+$/g, '').slice(0, 60) || 'home';
  } catch {
    return 'agencies';
  }
}

/**
 * Public lead form: an agency asking for its free prospect pack (or a call). Records the lead,
 * alerts the founder, and treats the same email asking again within a day as a double submit.
 */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limitOrThrow(`lead:ip:${clientIp(req)}`, 5, 3600_000, `You have sent several requests already. Please try again later, or email ${SITE.supportEmail}.`);
  const input = body.parse(await readJson(req));
  if (input.hp) throw new HttpError(400, 'Something went wrong. Please refresh the page and try again.', 'invalid');

  const name = oneLine(input.name);
  const company = oneLine(input.company);
  if (input.kind === 'pack') {
    if (!name) throw invalid('name', 'Tell us your name.');
    if (!company) throw invalid('company', 'Enter your agency name.');
    if (!input.website) throw invalid('website', 'Enter your agency website, so we can use your logo and colours.');
  }

  let website = '';
  if (input.website) {
    try {
      website = normalizeUrl(input.website).toString();
    } catch (error) {
      if (error instanceof UrlRejectedError) throw invalid('website', 'Enter your website address, for example https://youragency.com.');
      throw error;
    }
  }

  const existing = recentLeadFrom(input.email, input.kind);
  if (existing) return json({ ok: true, id: existing.id }, 201);

  const entries = input.prospects.map((value, index) => ({ value, index })).filter((e) => e.value);
  if (entries.length > MAX_PROSPECTS) throw invalid('prospects', `Send up to ${MAX_PROSPECTS} pages.`);
  const checked = await Promise.all(entries.map(async ({ value, index }): Promise<Checked> => {
    try {
      return { index, url: await validatePublicUrl(value) };
    } catch (error) {
      if (error instanceof UrlRejectedError) return { index, problem: error.message };
      throw error;
    }
  }));
  const problems = checked.flatMap((c) => ('problem' in c ? [{ index: c.index, message: c.problem }] : []));
  if (problems.length) throw new HttpError(400, problems[0].message, 'invalid_prospect', { field: 'prospects', index: problems[0].index, problems });

  const user = await currentUser();
  const lead = createLead({
    kind: input.kind, name, email: input.email, company, website, message: tidy(input.message),
    prospects: checked.flatMap((c) => ('url' in c ? [c.url] : [])), source: sourceOf(req), userId: user?.id ?? null,
  });

  const to = env.founderAlertEmail;
  if (to) {
    const alert = mailer.founderLead(to, {
      kind: lead.kind, name: lead.name, email: lead.email, company: lead.company, website: lead.website, prospects: lead.prospects, message: lead.message,
      adminUrl: `${env.appUrl}/admin/plan#pipeline`,
    }).catch((error) => console.error('[leads] founder alert failed', error));
    // A slow mail server must not hold up the visitor's confirmation.
    await within(alert, 5000);
  }
  return json({ ok: true, id: lead.id }, 201);
});

/** Waits for a promise, but never longer than `ms`. */
async function within(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise, new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  } finally {
    clearTimeout(timer);
  }
}
