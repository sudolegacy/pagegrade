import { handler, assertSameOrigin, json } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { GUEST_COOKIE, unlockGuestGrade } from '@/lib/server/grader';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** A signed-in visitor unlocks the full report of a grade they ran while signed out (uses 1 review). */
export const POST = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const id = unlockGuestGrade(user, (await params).id, req.cookies.get(GUEST_COOKIE)?.value, { admin: isAdmin(user) });
  return json({ id });
});
