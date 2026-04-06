import { Logger } from '@nestjs/common';
import {
  createAsyncFnCircuitBreaker,
} from 'src/transaction/infrastructure/providers/http/shared/circuit-breaker.factory';

const options = {
  timeout: 30_000,
  errorThresholdPercentage: 50,
  resetTimeout: 10_000,
  volumeThreshold: 100,
};

describe('circuit-breaker.factory (shared)', () => {
  const logger = new Logger('test-async-fn-breaker');

  it('createAsyncFnCircuitBreaker.fire runs inner function', async () => {
    const breaker = createAsyncFnCircuitBreaker(logger, options);
    const out = await breaker.fire(async () => 'ok');
    expect(out).toBe('ok');
  });
});
