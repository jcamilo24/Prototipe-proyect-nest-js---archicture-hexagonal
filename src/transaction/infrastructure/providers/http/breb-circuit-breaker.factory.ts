import { Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

import type { Transaction } from '../../../domain/entity/transaction.entity';
import type { ExternalTransferResult } from '../../../domain/providers/external-transfer.service';

export type BrebCircuitBreakerOptions = {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold?: number;
}

export type BrebCircuitBreakerInstance = {
  fire(tx: Transaction): Promise<ExternalTransferResult>;
  on(event: string, fn: () => void): void;
}

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