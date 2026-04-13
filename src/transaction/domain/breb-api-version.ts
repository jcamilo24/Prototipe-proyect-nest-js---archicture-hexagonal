export const BREB_API_VERSIONS = ['v1', 'v2'] as const;
export type BrebApiVersion = (typeof BREB_API_VERSIONS)[number];

export function parseBrebApiVersion(raw: string): BrebApiVersion | null {
  const v = raw?.trim().toLowerCase();
  if (v === 'v1' || v === 'v2') return v;
  return null;
}

export function resolveBrebApiVersion(raw: string): BrebApiVersion {
  return parseBrebApiVersion(raw) ?? 'v1';
}
