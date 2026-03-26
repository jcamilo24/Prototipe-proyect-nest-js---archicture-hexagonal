import {
  getCorrelationId,
  getIdempotencyKey,
  runWithCorrelationId,
  setCorrelationId,
  setIdempotencyKey,
} from '../../../src/common/utils/correlation.util';

describe('correlation.util', () => {
  it('getCorrelationId returns undefined when not inside runWithCorrelationId', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('runWithCorrelationId sets context and getCorrelationId returns the id', async () => {
    const result = await runWithCorrelationId('corr-123', async () => {
      expect(getCorrelationId()).toBe('corr-123');
      return 42;
    });
    expect(result).toBe(42);
    expect(getCorrelationId()).toBeUndefined();
  });

  it('setCorrelationId updates the id inside context', async () => {
    await runWithCorrelationId('original', async () => {
      expect(getCorrelationId()).toBe('original');
      setCorrelationId('updated');
      expect(getCorrelationId()).toBe('updated');
    });
  });

  it('stores idempotency key inside the same async context', async () => {
    await runWithCorrelationId('corr-1', async () => {
      expect(getIdempotencyKey()).toBeUndefined();
      setIdempotencyKey('idem-123');
      expect(getIdempotencyKey()).toBe('idem-123');
    });
    expect(getIdempotencyKey()).toBeUndefined();
  });
});
