import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { requireApiUser, clearSessionCookie, isAdmin } from '@/lib/server/session';
import { deleteUser, passwordHashFor, updateUser } from '@/lib/server/users';
import { verifyPassword } from '@/lib/server/password';
import { deleteAllReviewFiles, entitledPlan } from '@/lib/server/reviews';
import { deleteBrandFiles } from '@/lib/server/brand';
import { cancelForDeletion } from '@/lib/server/billing';
import { accountView } from '@/lib/server/account';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => json(accountView(await requireApiUser())));

const patch = z.object({
  name: z.string().trim().max(80).optional(),
  notifyOnComplete: z.boolean().optional(),
  notifyMonitor: z.boolean().optional(),
  brandName: z.string().trim().max(60).optional(),
  brandWebsite: z.string().trim().max(200).optional(),
  brandColor: z.string().trim().max(7).optional(),
  whiteLabel: z.boolean().optional(),
});

function cleanWebsite(input: string): string {
  if (!input) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
    return u.toString().replace(/\/$/, '');
  } catch {
    throw new HttpError(400, 'Enter a website address like youragency.co.uk.', 'invalid_website', { field: 'brandWebsite' });
  }
}

export const PATCH = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const input = patch.parse(await readJson(req));
  const brandEdit = input.brandName !== undefined || input.brandWebsite !== undefined || input.brandColor !== undefined || input.whiteLabel !== undefined;
  if (brandEdit && !isAdmin(user) && !entitledPlan(user).limits.branding) throw new HttpError(402, 'Branded reports are part of the Agency plan.', 'branding_unavailable');
  if (input.brandColor && !/^#[0-9a-fA-F]{6}$/.test(input.brandColor)) throw new HttpError(400, 'Use a colour code like #1F6FEB.', 'invalid_color', { field: 'brandColor' });
  const website = input.brandWebsite === undefined ? undefined : cleanWebsite(input.brandWebsite);
  updateUser(user.id, {
    ...(input.notifyMonitor !== undefined ? { notify_monitor: input.notifyMonitor ? 1 : 0 } : {}),
    ...(input.brandName !== undefined ? { brand_name: input.brandName } : {}),
    ...(website !== undefined ? { brand_website: website } : {}),
    ...(input.brandColor !== undefined ? { brand_color: input.brandColor } : {}),
    ...(input.whiteLabel !== undefined ? { white_label: input.whiteLabel ? 1 : 0 } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.notifyOnComplete !== undefined ? { notify_on_complete: input.notifyOnComplete ? 1 : 0 } : {}),
  });
  return json({ ok: true });
});

const del = z.object({ password: z.string().min(1, 'Enter your password to confirm.').max(200) });
export const DELETE = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { password } = del.parse(await readJson(req));
  if (!(await verifyPassword(password, passwordHashFor(user.id) ?? ''))) throw new HttpError(401, 'That password is not right.', 'invalid_password', { field: 'password' });
  await cancelForDeletion(user);
  await deleteAllReviewFiles(user.id);
  await deleteBrandFiles(user.id);
  deleteUser(user.id);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
