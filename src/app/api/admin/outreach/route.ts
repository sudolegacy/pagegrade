import { z } from 'zod';
import { now } from '@/lib/server/db';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { OUTREACH_LIMITS, upsertOutreachWeek } from '@/lib/server/metrics-history';

export const dynamic = 'force-dynamic';

const MAX_AGE_MS = 2 * 365 * 24 * 3600 * 1000;

const count = z.number({ error: 'Enter a number.' }).int('Use a whole number.').min(0, 'Use zero or more.')
  .max(OUTREACH_LIMITS.count, `Use ${OUTREACH_LIMITS.count.toLocaleString('en-GB')} or fewer.`);

const body = z.object({
  weekStart: z.number({ error: 'Choose a week.' }).int('Choose a week.'),
  prospectsEmailed: count,
  replies: count,
  packRequests: count,
  optOuts: count,
  bounces: count,
  calls: count.optional(),
  note: z.string().trim().max(OUTREACH_LIMITS.note, `Keep the note to ${OUTREACH_LIMITS.note} characters or fewer.`).optional(),
});

/** Admin: save one week of outreach numbers copied from the Autopilot sheet. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new HttpError(403, 'Admins only.', 'forbidden');
  const { weekStart, ...numbers } = body.parse(await readJson(req));
  const t = now();
  if (weekStart > t) throw new HttpError(400, 'That week has not started yet.', 'invalid_input', { field: 'weekStart' });
  if (weekStart < t - MAX_AGE_MS) throw new HttpError(400, 'That week is more than two years ago.', 'invalid_input', { field: 'weekStart' });
  upsertOutreachWeek(weekStart, numbers);
  return json({ ok: true });
});
