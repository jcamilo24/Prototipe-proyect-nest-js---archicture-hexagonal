import { Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

import type { Transaction } from '../../../domain/entity/transaction.entity';
import type { ExternalTransferResult } from '../../../domain/providers/external-transfer.service';

export type BrebCircuitBreakerOptions = {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold?: number;
};

export type BrebCircuitBreakerInstance = {
  fire(tx: Transaction): Promise<ExternalTransferResult>;
  on(event: string, fn: () => void): void;
};

/** Circuit breaker para el adapter (acción por transacción). */
export function createBrebCircuitBreaker(
  action: (tx: Transaction) => Promise<ExternalTransferResult>,
  logger: Logger,
  options: BrebCircuitBreakerOptions,
): BrebCircuitBreakerInstance {
  const breaker = new CircuitBreaker(action, options) as BrebCircuitBreakerInstance;

  breaker.on('open', () => logger.warn('BREB circuit OPEN'));
  breaker.on('halfOpen', () => logger.warn('BREB circuit HALF-OPEN'));
  breaker.on('close', () => logger.log('BREB circuit CLOSED'));

  return breaker;
}

/** Circuit breaker genérico para el cliente HTTP: protege cualquier llamada asíncrona. */
export type BrebHttpCircuitBreakerInstance = {
  fire<T>(fn: () => Promise<T>): Promise<T>;
  on(event: string, fn: () => void): void;
};

export function createBrebHttpCircuitBreaker(
  logger: Logger,
  options: BrebCircuitBreakerOptions,
): BrebHttpCircuitBreakerInstance {
  const action = (fn: () => Promise<unknown>) => fn();
  const breaker = new CircuitBreaker(action, options);

  breaker.on('open', () => logger.warn('BREB HTTP circuit OPEN'));
  breaker.on('halfOpen', () => logger.warn('BREB HTTP circuit HALF-OPEN'));
  breaker.on('close', () => logger.log('BREB HTTP circuit CLOSED'));

  return {
    fire<T>(fn: () => Promise<T>): Promise<T> {
      return breaker.fire(fn) as Promise<T>;
    },
    on(event: string, fn: () => void): void {
      breaker.on(event, fn);
    },
  };
}