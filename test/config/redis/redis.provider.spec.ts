jest.mock('ioredis', () => jest.fn());

import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisProvider } from 'src/config/redis/redis.provider';

describe('RedisProvider', () => {
  const MockedRedis = Redis as unknown as jest.Mock;

  beforeEach(() => {
    MockedRedis.mockClear();
  });

  it('creates Redis with host and port from config', () => {
    const config = {
      get: (key: string) => {
        if (key === 'REDIS_HOST') return 'redis-host';
        if (key === 'REDIS_PORT') return '6380';
        return undefined;
      },
    } as unknown as ConfigService;

    RedisProvider.useFactory(config);

    expect(MockedRedis).toHaveBeenCalledWith({
      host: 'redis-host',
      port: 6380,
    });
  });

  it('uses localhost and 6379 when env missing', () => {
    const config = {
      get: () => undefined,
    } as unknown as ConfigService;

    RedisProvider.useFactory(config);

    expect(MockedRedis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
    });
  });
});
