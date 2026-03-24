import {
  getCorrelationId,
  runWithCorrelationId,
  setCorrelationId,
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
});
