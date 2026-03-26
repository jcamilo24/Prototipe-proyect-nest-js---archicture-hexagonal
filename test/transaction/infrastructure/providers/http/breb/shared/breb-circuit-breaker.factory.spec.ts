import { Logger } from '@nestjs/common';
import {
  createBrebCircuitBreaker,
  createBrebHttpCircuitBreaker,
} from 'src/transaction/infrastructure/providers/http/breb/shared/breb-circuit-breaker.factory';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

const options = {
  timeout: 30_000,
  errorThresholdPercentage: 50,
  resetTimeout: 10_000,
  volumeThreshold: 100,
};

describe('breb-circuit-breaker.factory', () => {
  const logger = new Logger('test-breb-breaker');

  it('createBrebHttpCircuitBreaker.fire runs inner function', async () => {
    const breaker = createBrebHttpCircuitBreaker(logger, options);
    const out = await breaker.fire(async () => 'ok');
    expect(out).toBe('ok');
  });

  it('createBrebCircuitBreaker.fire invokes action with transaction', async () => {
    const result = {
      externalId: 'ext',
      status: TransactionStatus.CONFIRMED,
      traceId: 'tr',
    };
    const action = jest.fn().mockResolvedValue(result);
    const tx = new Transaction(
      'id-1',
      1,
      'USD',
      'd',
      '1',
      'CC',
      'n',
      'a',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    const breaker = createBrebCircuitBreaker(action, logger, options);
    const out = await breaker.fire(tx);

    expect(action).toHaveBeenCalledWith(tx);
    expect(out).toEqual(result);
  });
});
