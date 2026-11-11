import { createHash, randomBytes } from 'node:crypto';

/** URL-safe random identifier (default 16 bytes ≈ 128 bits). */
export const randomId = (bytes = 16) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
