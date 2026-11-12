import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { LEAD_STATUSES, deleteWidgetLead, setWidgetLeadStatus } from '@/lib/server/widget';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({ status: z.enum(LEAD_STATUSES, 'Choose a status from the list.') });

// Owners can manage and delete their leads even after their plan lapses: the data is theirs.
export const PATCH = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  setWidgetLeadStatus(user.id, (await params).id, patch.parse(await readJson(req)).status);
  return json({ ok: true });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await deleteWidgetLead(user.id, (await params).id);
  return json({ ok: true });
});
