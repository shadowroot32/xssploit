import { createHash, randomBytes } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

/** URL-safe random token for blind-XSS callback correlation. */
export function randomToken(bytes = 12): string {
  return randomBytes(bytes).toString('base64url');
}
