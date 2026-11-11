import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { createMonitor, listMonitors, monitorQuota } from '@/lib/server/monitors';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ monitors: listMonitors(user), quota: monitorQuota(user) }, { headers: { 'Cache-Control': 'no-store' } });
});

const body = z.object({
  reviewId: z.string().trim().min(1, 'Choose a finished review.').max(40),
  kind: z.enum(['own', 'competitor']).default('own'),
  label: z.string().trim().max(80).optional(),
  clientId: z.string().trim().max(40).nullish(),
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const input = body.parse(await readJson(req));
  return json({ monitor: createMonitor(user, input) }, 201);
});
