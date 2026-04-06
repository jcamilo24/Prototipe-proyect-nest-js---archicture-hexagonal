import { Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

/** Opciones compatibles con opossum; reutilizable para cualquier cliente HTTP u otro adaptador. */
export type CircuitBreakerOptions = {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold?: number;
};

export type AsyncFnCircuitBreaker = {
  fire<T>(fn: () => Promise<T>): Promise<T>;
  on(event: string, fn: () => void): void;
};

export function createAsyncFnCircuitBreaker(
  logger: Logger,
  options: CircuitBreakerOptions,
): AsyncFnCircuitBreaker {
  const action = (fn: () => Promise<unknown>) => fn();
  const breaker = new CircuitBreaker(action, options);

  breaker.on('open', () => logger.warn('Circuit breaker OPEN'));
  breaker.on('halfOpen', () => logger.warn('Circuit breaker HALF-OPEN'));
  breaker.on('close', () => logger.log('Circuit breaker CLOSED'));

  return {
    fire<T>(fn: () => Promise<T>): Promise<T> {
      return breaker.fire(fn) as Promise<T>;
    },
    on(event: string, fn: () => void): void {
      breaker.on(event, fn);
    },
  };
}
