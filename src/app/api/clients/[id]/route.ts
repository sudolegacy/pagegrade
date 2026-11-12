import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { canBrand, discardLogo } from '@/lib/server/brand';
import { clientLook, deleteClient, updateClient } from '@/lib/server/clients';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// The logo is changed only through the upload route, so it is not accepted here. Lengths and colours are checked, with friendlier messages, by updateClient.
const patch = z.object({
  name: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
  brandName: z.string().max(200).optional(),
  brandColor: z.string().max(20).optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const input = patch.parse(await readJson(req));
  if ((input.brandName !== undefined || input.brandColor !== undefined) && !canBrand(user)) {
    throw new HttpError(402, 'Branded reports are part of the Agency plan.', 'branding_unavailable');
  }
  return json({ client: updateClient(user.id, (await params).id, input) });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await params;
  const logo = clientLook(user.id, id)?.brand.logo;
  deleteClient(user.id, id);
  await discardLogo(logo);
  return json({ ok: true });
});
