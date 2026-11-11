import { handler, json, HttpError } from '@/lib/server/http';
import { GUEST_COOKIE, getGradeTeaser } from '@/lib/server/grader';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const teaser = getGradeTeaser((await params).id, req.cookies.get(GUEST_COOKIE)?.value);
  if (!teaser) throw new HttpError(404, 'This grade was not found. Free grades are kept for 30 days.', 'not_found');
  return json(teaser, { headers: { 'Cache-Control': 'no-store' } });
});
