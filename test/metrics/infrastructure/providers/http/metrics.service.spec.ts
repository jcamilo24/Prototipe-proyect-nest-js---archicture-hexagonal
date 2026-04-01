import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MetricsService } from 'src/metrics/infrastructure/providers/http/metrics.service';
import type { PrometheusMetrics } from 'src/metrics/infrastructure/prometheus/prometheus.metrics';

describe('MetricsService', () => {
  let redis: {
    hincrby: jest.Mock;
    hgetall: jest.Mock;
  };
  let config: ConfigService;
  let prometheus: { recordAfterRedisOk: jest.Mock };

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
    prometheus = { recordAfterRedisOk: jest.fn() };
  });

  function makeService(): MetricsService {
    return new MetricsService(
      redis as unknown as Redis,
      config,
      prometheus as unknown as PrometheusMetrics,
    );
  }

  it('increment uses HINCRBY on configured redis key', async () => {
    const service = makeService();

    await service.increment('breb_calls');

    expect(redis.hincrby).toHaveBeenCalledWith('custom:metrics', 'breb_calls', 1);
    expect(prometheus.recordAfterRedisOk).toHaveBeenCalledWith('breb_calls');
  });

  it('increment swallows Redis errors and does not touch Prometheus', async () => {
    redis.hincrby.mockRejectedValue(new Error('redis down'));
    const service = makeService();

    await expect(service.increment('transfer_created')).resolves.toBeUndefined();

    expect(prometheus.recordAfterRedisOk).not.toHaveBeenCalled();
  });

  it('getMetrics parses hgetall into numbers', async () => {
    const service = makeService();

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
    const service = makeService();

    const result = await service.getMetrics();

    expect(result).toEqual({
      transfer_created: 0,
      transfer_failed: 0,
      breb_calls: 0,
      breb_errors: 0,
    });
  });
});
