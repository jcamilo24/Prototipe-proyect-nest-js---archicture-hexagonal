import { ConfigService } from '@nestjs/config';
import {
  resolveBrebV1BaseUrl,
  resolveBrebV2BaseUrl,
} from 'src/transaction/infrastructure/providers/http/breb/config/breb-http2.config';

describe('breb-http2.config', () => {
  describe('resolveBrebV1BaseUrl', () => {
    it('prefers BREB_V1_BASE_URL', () => {
      const config = {
        get: (k: string) =>
          k === 'BREB_V1_BASE_URL' ? 'http://v1-only/transfer' : undefined,
      } as unknown as ConfigService;

      expect(resolveBrebV1BaseUrl(config)).toBe('http://v1-only/transfer');
    });

    it('falls back to BREB_BASE_URL', () => {
      const config = {
        get: (k: string) =>
          k === 'BREB_BASE_URL' ? 'http://legacy/transfer' : undefined,
      } as unknown as ConfigService;

      expect(resolveBrebV1BaseUrl(config)).toBe('http://legacy/transfer');
    });

    it('uses default when unset', () => {
      const config = { get: () => undefined } as unknown as ConfigService;

      expect(resolveBrebV1BaseUrl(config)).toBe(
        'http://localhost:3001/transfer',
      );
    });
  });

  describe('resolveBrebV2BaseUrl', () => {
    it('uses BREB_V2_BASE_URL when set', () => {
      const config = {
        get: (k: string) =>
          k === 'BREB_V2_BASE_URL' ? 'http://host/payments' : undefined,
      } as unknown as ConfigService;

      expect(resolveBrebV2BaseUrl(config)).toBe('http://host/payments');
    });

    it('defaults to local payments', () => {
      const config = { get: () => undefined } as unknown as ConfigService;

      expect(resolveBrebV2BaseUrl(config)).toBe('http://localhost:3001/payments');
    });
  });
});
