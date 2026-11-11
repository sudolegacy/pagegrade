import { handler, assertSameOrigin, json, HttpError } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { deleteReview, getReview, getReviewStatus } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const review = req.nextUrl.searchParams.get('view') === 'status' ? getReviewStatus(id, user.id) : getReview(id, user.id);
  if (!review) throw new HttpError(404, 'Review not found.', 'not_found');
  return json(review, { headers: { 'Cache-Control': 'no-store' } });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await deleteReview((await params).id, user.id);
  return json({ ok: true });
});
