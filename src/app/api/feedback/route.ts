import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { addFeedback } from '@/lib/server/feedback';

export const dynamic = 'force-dynamic';

const body = z.object({
  kind: z.enum(['signup', 'general']).default('signup'),
  answer: z.string().trim().max(80).default(''),
  comment: z.string().trim().max(2000).default(''),
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  limitOrThrow(`feedback:user:${user.id}`, 20, 3600_000);
  const input = body.parse(await readJson(req));
  // One onboarding answer per account; general feedback can be sent any time.
  addFeedback({ userId: user.id, kind: input.kind, answer: input.answer, comment: input.comment, ref: input.kind === 'signup' ? `signup:${user.id}` : null });
  return json({ ok: true });
});
