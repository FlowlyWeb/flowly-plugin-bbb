import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of a client-provided secret (API key, webhook token)
 * against the expected value.
 *
 * Both values are hashed first so that inputs of different lengths can be
 * compared with crypto.timingSafeEqual without leaking the expected length.
 * Returns false when the expected value is not configured.
 */
export function safeCompare(provided: unknown, expected: string | null | undefined): boolean {
  if (typeof provided !== 'string' || !expected) {
    return false;
  }

  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}
