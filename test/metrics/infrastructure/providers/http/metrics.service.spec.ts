import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MetricsService } from 'src/metrics/infrastructure/providers/http/metrics.service';

describe('MetricsService', () => {
  let redis: {
    hincrby: jest.Mock;
    hgetall: jest.Mock;
  };
  let config: ConfigService;

  beforeEach(() => {
    redis = {
      hincrby: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({
        transfer_created: '3',
        transfer_failed: '1',
        breb_calls: '10',
        breb_errors: '2',
      }),
    };
    config = {
      get: jest.fn().mockImplementation((key: string) =>
        key === 'METRICS_REDIS_KEY' ? 'custom:metrics' : undefined,
      ),
    } as unknown as ConfigService;
  });

  it('increment uses HINCRBY on configured redis key', async () => {
    const service = new MetricsService(redis as unknown as Redis, config);

    await service.increment('breb_calls');

    expect(redis.hincrby).toHaveBeenCalledWith('custom:metrics', 'breb_calls', 1);
  });

  it('increment swallows Redis errors', async () => {
    redis.hincrby.mockRejectedValue(new Error('redis down'));
    const service = new MetricsService(redis as unknown as Redis, config);

    await expect(service.increment('transfer_created')).resolves.toBeUndefined();
  });

  it('getMetrics parses hgetall into numbers', async () => {
    const service = new MetricsService(redis as unknown as Redis, config);

    const result = await service.getMetrics();

    expect(redis.hgetall).toHaveBeenCalledWith('custom:metrics');
    expect(result).toEqual({
      transfer_created: 3,
      transfer_failed: 1,
      breb_calls: 10,
      breb_errors: 2,
    });
  });

  it('getMetrics returns zeros when Redis fails', async () => {
    redis.hgetall.mockRejectedValue(new Error('read fail'));
    const service = new MetricsService(redis as unknown as Redis, config);

    const result = await service.getMetrics();

    expect(result).toEqual({
      transfer_created: 0,
      transfer_failed: 0,
      breb_calls: 0,
      breb_errors: 0,
    });
  });
});
