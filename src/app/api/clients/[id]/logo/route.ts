import { handler, assertSameOrigin, json, HttpError } from '@/lib/server/http';
import { requireApiUser } from '@/lib/server/session';
import { limitOrThrow } from '@/lib/server/auth-flows';
import { MAX_LOGO_BYTES, removeClientLogo, saveClientLogo } from '@/lib/server/brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

/** Upload the logo that reports in this client folder carry (multipart form, field "logo"). */
export const POST = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  limitOrThrow(`logo:client:${user.id}`, 60, 3600_000);
  if (Number(req.headers.get('content-length') || 0) > MAX_LOGO_BYTES + 64 * 1024) throw new HttpError(413, 'The logo must be smaller than 2 MB.', 'logo_too_large');
  const form = await req.formData().catch(() => null);
  const file = form?.get('logo');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose an image to upload.', 'logo_missing');
  if (file.size > MAX_LOGO_BYTES) throw new HttpError(413, 'The logo must be smaller than 2 MB.', 'logo_too_large');
  const name = await saveClientLogo(user, (await params).id, Buffer.from(await file.arrayBuffer()));
  return json({ logo: name, logoUrl: `/api/brand/logo/${name}` });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await removeClientLogo(user, (await params).id);
  return json({ ok: true });
});
