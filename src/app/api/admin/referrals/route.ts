import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { markReferralsPaid } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';

const body = z.object({ referrerId: z.string().trim().min(1).max(40) });

/** Admin: record that a partner's payable commission has been paid (the payment itself is made outside PageGrade). */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new HttpError(403, 'Admins only.', 'forbidden');
  const { referrerId } = body.parse(await readJson(req));
  return json({ paidPence: markReferralsPaid(referrerId) });
});
