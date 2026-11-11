import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env';
import { HttpError } from './errors';
import { entitledPlan } from './reviews';
import { isAdmin } from './session';
import { updateUser, type Brand, type User } from './users';

/** Branded reports (Agency plan): logo, name, colour and website on PDFs and shared reports. */
export const LOGO_FILE_RE = /^[A-Za-z0-9_-]{6,60}\.png$/;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export type ReportBrand = Brand & { logoUrl: string | null };

const canBrand = (user: User) => isAdmin(user) || entitledPlan(user).limits.branding;

/** Branding to show on this user's reports, if their plan includes it and they have set some up. */
export function brandFor(user: User | null | undefined): ReportBrand | null {
  if (!user || !canBrand(user)) return null;
  const b = user.brand;
  if (!b.name && !b.logo) return null;
  return { ...b, logoUrl: b.logo ? `/api/brand/logo/${b.logo}` : null };
}

const logoPath = (file: string) => {
  if (!LOGO_FILE_RE.test(file)) throw new Error('invalid logo name');
  return path.join(env.brandsDir, file);
};

/** Validate, resize and store a logo as PNG. SVG is refused on purpose (it can carry scripts). */
export async function saveLogo(user: User, input: Buffer): Promise<string> {
  if (!canBrand(user)) throw new HttpError(402, 'Branded reports are part of the Agency plan.', 'branding_unavailable');
  if (input.length > MAX_LOGO_BYTES) throw new HttpError(413, 'The logo must be smaller than 2 MB.', 'logo_too_large');
  let png: Buffer;
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new Error('format');
    png = await sharp(input).rotate().resize({ width: 600, height: 200, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new HttpError(400, 'Upload a PNG, JPEG or WebP image.', 'logo_invalid');
  }
  await mkdir(env.brandsDir, { recursive: true });
  const file = `${user.id}-${randomBytes(4).toString('hex')}.png`;
  await writeFile(logoPath(file), png);
  updateUser(user.id, { brand_logo: file });
  const old = user.brand.logo;
  if (old && old !== file && LOGO_FILE_RE.test(old)) await rm(logoPath(old), { force: true }).catch(() => undefined);
  return file;
}

export async function removeLogo(user: User) {
  const old = user.brand.logo;
  updateUser(user.id, { brand_logo: null });
  if (old && LOGO_FILE_RE.test(old)) await rm(logoPath(old), { force: true }).catch(() => undefined);
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
