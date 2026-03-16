import { createHash } from 'crypto';

/**
 * Returns a stable SHA-256 hash of the payload for comparison (e.g. idempotency).
 */
export function generateRequestHash(payload: unknown): string {
  const jsonString = JSON.stringify(payload);

  return createHash('sha256').update(jsonString).digest('hex');
}
