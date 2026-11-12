import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env';
import { HttpError } from './errors';
import { clientLook, updateClient, type ClientLook } from './clients';
import { entitledPlan } from './reviews';
import { isAdmin } from './session';
import { updateUser, type Brand, type User } from './users';

/** Branded reports (Agency plan): logo, name, colour and website on PDFs and shared reports. */
export const LOGO_FILE_RE = /^[A-Za-z0-9_-]{6,60}\.png$/;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export type ReportBrand = Brand & { logoUrl: string | null };

export const canBrand = (user: User) => isAdmin(user) || entitledPlan(user).limits.branding;

/** Branding to show on this user's reports, if their plan includes it and they have set some up. */
export function brandFor(user: User | null | undefined): ReportBrand | null {
  if (!user || !canBrand(user)) return null;
  const b = user.brand;
  if (!b.name && !b.logo) return null;
  return { ...b, logoUrl: b.logo ? `/api/brand/logo/${b.logo}` : null };
}

/**
 * Branding for one review's reports. A client folder with its own name or logo takes the account's place
 * entirely (so the account's logo never sits next to another name); its website is used when it has one.
 * White label stays the account's setting. Without folder branding this is brandFor(user), and a user whose
 * plan has no branding gets none either way.
 */
export function brandForReview(user: User | null | undefined, folder: ClientLook | null | undefined): ReportBrand | null {
  if (!user || !canBrand(user)) return null;
  const own = folder?.brand;
  if (!folder || !own || (!own.name && !own.logo)) return brandFor(user);
  return { name: own.name, color: own.color, website: folder.website || user.brand.website, logo: own.logo, whiteLabel: user.brand.whiteLabel, logoUrl: own.logoUrl };
}

/** The brand a review's reports carry, found through the client folder it is filed in. */
export function reportBrand(user: User | null | undefined, clientId: string | null | undefined): ReportBrand | null {
  return brandForReview(user, user && clientId ? clientLook(user.id, clientId) : null);
}

const logoPath = (file: string) => {
  if (!LOGO_FILE_RE.test(file)) throw new Error('invalid logo name');
  return path.join(env.brandsDir, file);
};

const assertCanBrand = (user: User) => {
  if (!canBrand(user)) throw new HttpError(402, 'Branded reports are part of the Agency plan.', 'branding_unavailable');
};

/** Validate and resize a logo to PNG. SVG is refused on purpose (it can carry scripts). */
async function resizedLogo(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_LOGO_BYTES) throw new HttpError(413, 'The logo must be smaller than 2 MB.', 'logo_too_large');
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new Error('format');
    return await sharp(input).rotate().resize({ width: 600, height: 200, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new HttpError(400, 'Upload a PNG, JPEG or WebP image.', 'logo_invalid');
  }
}

/** Files start with the user's id, so deleteBrandFiles can remove them all when the account is deleted. */
async function storeLogoFile(user: User, png: Buffer): Promise<string> {
  await mkdir(env.brandsDir, { recursive: true });
  const file = `${user.id}-${randomBytes(4).toString('hex')}.png`;
  await writeFile(logoPath(file), png);
  return file;
}

/** Deletes a stored logo unless it is `keep`. A missing file is fine. */
export async function discardLogo(file: string | null | undefined, keep?: string) {
  if (file && file !== keep && LOGO_FILE_RE.test(file)) await rm(logoPath(file), { force: true }).catch(() => undefined);
}

/** Validate, resize and store the account logo as PNG. */
export async function saveLogo(user: User, input: Buffer): Promise<string> {
  assertCanBrand(user);
  const png = await resizedLogo(input);
  const file = await storeLogoFile(user, png);
  updateUser(user.id, { brand_logo: file });
  await discardLogo(user.brand.logo, file);
  return file;
}

export async function removeLogo(user: User) {
  const old = user.brand.logo;
  updateUser(user.id, { brand_logo: null });
  await discardLogo(old);
}

/** The same for a client folder's own logo. The folder must belong to the user. */
export async function saveClientLogo(user: User, clientId: string, input: Buffer): Promise<string> {
  assertCanBrand(user);
  const folder = clientLook(user.id, clientId);
  if (!folder) throw new HttpError(404, 'Client folder not found.', 'not_found');
  const png = await resizedLogo(input);
  const file = await storeLogoFile(user, png);
  try {
    updateClient(user.id, clientId, { brandLogo: file });
  } catch (error) {
    await discardLogo(file);
    throw error;
  }
  await discardLogo(folder.brand.logo, file);
  return file;
}

export async function removeClientLogo(user: User, clientId: string) {
  const folder = clientLook(user.id, clientId);
  if (!folder) throw new HttpError(404, 'Client folder not found.', 'not_found');
  updateClient(user.id, clientId, { brandLogo: null });
  await discardLogo(folder.brand.logo);
}

export async function readLogo(file: string): Promise<Buffer | null> {
  if (!LOGO_FILE_RE.test(file)) return null;
  return readFile(logoPath(file)).catch(() => null);
}

/** Remove every logo a user uploaded (used when an account is deleted). */
export async function deleteBrandFiles(userId: string) {
  const files = await readdir(env.brandsDir).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => f.startsWith(`${userId}-`) && LOGO_FILE_RE.test(f)).map((f) => rm(logoPath(f), { force: true }).catch(() => undefined)));
}
