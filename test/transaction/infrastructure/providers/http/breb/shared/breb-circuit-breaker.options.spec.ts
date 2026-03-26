import { ConfigService } from '@nestjs/config';
import { getBrebCircuitBreakerOptions } from 'src/transaction/infrastructure/providers/http/breb/shared/breb-circuit-breaker.options';

describe('getBrebCircuitBreakerOptions', () => {
  const fullConfig = {
    get: (key: string) => {
      const map: Record<string, string> = {
        BREB_CIRCUIT_TIMEOUT_MS: '5000',
        BREB_CIRCUIT_ERROR_THRESHOLD_PERCENT: '50',
        BREB_CIRCUIT_RESET_TIMEOUT_MS: '10000',
        BREB_CIRCUIT_VOLUME_THRESHOLD: '5',
      };
      return map[key];
    },
  } as unknown as ConfigService;

  it('returns options when all env vars are set', () => {
    expect(getBrebCircuitBreakerOptions(fullConfig)).toEqual({
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      volumeThreshold: 5,
    });
  });

  it('throws listing missing keys when any value is absent', () => {
    const partial = {
      get: (key: string) =>
        key === 'BREB_CIRCUIT_TIMEOUT_MS' ? '1000' : undefined,
    } as unknown as ConfigService;

    expect(() => getBrebCircuitBreakerOptions(partial)).toThrow(
      /Missing required env/,
    );
  });
});
