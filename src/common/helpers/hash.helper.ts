import { createHash } from 'crypto';

export function generateRequestHash(payload: unknown): string {
  // Convertimos a string consistente
  const jsonString = JSON.stringify(payload);

  return createHash('sha256')
    .update(jsonString)
    .digest('hex');
}