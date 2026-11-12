import { z } from 'zod';
import { handler, assertSameOrigin, clientIp, readJson, json, HttpError } from '@/lib/server/http';
import { emailSchema, limitOrThrow } from '@/lib/server/auth-flows';
import { rateLimit } from '@/lib/server/ratelimit';
import { capacityCheck } from '@/lib/server/reviews';
import { WIDGET_PER_IP, publicWidget, startWidgetAudit } from '@/lib/server/widget';
import { GOALS, type Goal } from '@/lib/engine/intake';
import { UrlRejectedError, validatePublicUrl } from '@/lib/engine/net/url-guard';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ widgetId: string }> };

const body = z.object({
  url: z.string().trim().min(3, 'Enter the address of the page you want checked.').max(2048, 'That web address is too long.'),
  goal: z.enum(Object.keys(GOALS) as [Goal, ...Goal[]]).catch('lead'),
  name: z.string().trim().max(80, 'Keep your name under 80 characters.').default(''),
  email: emailSchema,
  source: z.string().max(2000).catch(''),
  hp: z.string().max(200).optional(), // honeypot: people never see this field
});

/** The page the widget sits on (the iframe's referrer), as origin and path only. */
function sourcePage(raw: string): string {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) ? `${u.origin}${u.pathname === '/' ? '' : u.pathname}`.slice(0, 300) : '';
  } catch {
    return '';
  }
}

/**
 * Public: a visitor starts an audit through an agency's lead widget. The widget page is
 * served by us inside the iframe, so its requests are same-origin and the CSRF check applies.
 */
export const POST = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  limitOrThrow(`widget:try:${ip}`, 20, 3600_000, 'Too many attempts. Please wait a few minutes and try again.');
  const found = publicWidget((await params).widgetId);
  if (!found) throw new HttpError(404, 'This website check is not available right now.', 'widget_unavailable');
  const input = body.parse(await readJson(req));
  if (input.hp) throw new HttpError(400, 'Something went wrong. Please refresh the page and try again.', 'invalid');

  let url: string;
  try {
    url = await validatePublicUrl(input.url);
  } catch (error) {
    if (error instanceof UrlRejectedError) throw new HttpError(400, error.message, `url_${error.code}`, { field: 'url' });
    throw error;
  }
  if (!capacityCheck(found.owner).ok) throw new HttpError(503, 'The website check is very busy right now. Please try again later.', 'capacity');
  if (!rateLimit(`widget:ip:${found.widget.id}:${ip}`, WIDGET_PER_IP, 24 * 3600_000).ok) {
    throw new HttpError(429, "You've used today's free checks. Please come back tomorrow, or get in touch directly.", 'widget_limit');
  }
  const { leadId, key } = startWidgetAudit(found.widget, found.owner, { url, goal: input.goal, name: input.name, email: input.email, source: sourcePage(input.source) }, { admin: found.admin });
  return json({ id: leadId, key }, 201);
});
