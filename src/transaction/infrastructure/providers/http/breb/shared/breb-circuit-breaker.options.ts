import { ConfigService } from '@nestjs/config';
import type { CircuitBreakerOptions } from '../../shared/circuit-breaker.factory';

const ENV_KEYS: Record<keyof CircuitBreakerOptions, string> = {
  timeout: 'BREB_CIRCUIT_TIMEOUT_MS',
  errorThresholdPercentage: 'BREB_CIRCUIT_ERROR_THRESHOLD_PERCENT',
  resetTimeout: 'BREB_CIRCUIT_RESET_TIMEOUT_MS',
  volumeThreshold: 'BREB_CIRCUIT_VOLUME_THRESHOLD',
};

function parseEnvInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Lee variables `BREB_CIRCUIT_*` (mismo contrato que `CircuitBreakerOptions`). */
export function getBrebCircuitBreakerOptions(
  config: ConfigService,
): CircuitBreakerOptions {
  const timeout = parseEnvInt(config.get(ENV_KEYS.timeout));
  const errorThresholdPercentage = parseEnvInt(
    config.get(ENV_KEYS.errorThresholdPercentage),
  );
  const resetTimeout = parseEnvInt(config.get(ENV_KEYS.resetTimeout));
  const volumeThreshold = parseEnvInt(config.get(ENV_KEYS.volumeThreshold));

  const missing = [
    timeout == null && ENV_KEYS.timeout,
    errorThresholdPercentage == null && ENV_KEYS.errorThresholdPercentage,
    resetTimeout == null && ENV_KEYS.resetTimeout,
    volumeThreshold == null && ENV_KEYS.volumeThreshold,
  ]
    .filter(Boolean) as string[];

  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }

  return {
    timeout: timeout!,
    errorThresholdPercentage: errorThresholdPercentage!,
    resetTimeout: resetTimeout!,
    volumeThreshold: volumeThreshold!,
  };
}
