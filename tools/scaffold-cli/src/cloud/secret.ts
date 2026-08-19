import { randomBytes } from 'node:crypto';

// A strong URL-safe JWT secret. 48 random bytes -> 64 base64url chars, no padding.
export function strongSecret(): string {
  return randomBytes(48).toString('base64url');
}
