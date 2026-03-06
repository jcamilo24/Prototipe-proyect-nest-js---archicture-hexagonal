import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisIdempotencyService } from './redis-idempotency.service';

describe('RedisIdempotencyService', () => {
  let service: RedisIdempotencyService;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
  };
  let configService: ConfigService;

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'IDEMPOTENCY_KEY_PREFIX') return 'idempotency';
        if (key === 'IDEMPOTENCY_TTL_SECONDS') return '86400';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new RedisIdempotencyService(
      redis as never,
      configService,
    );
  });

  it('returns cached response for same key and same payload', async () => {
    const cachedResponse = {
      id: 'tx-003',
      status: 'SUCCESS',
    };

    redis.get.mockResolvedValue(
      JSON.stringify({
        id: 'record-1',
        idempotency_key: 'transfer-002',
        request_hash: 'same-hash',
        response: cachedResponse,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      }),
    );

    const execute = jest.fn().mockResolvedValue({
      id: 'should-not-run',
    });

    const result = await service.handle(
      'transfer-002',
      'same-hash',
      execute,
    );

    expect(result).toEqual(cachedResponse);
    expect(execute).not.toHaveBeenCalled();
  });

  it('throws conflict for same key with different payload', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        id: 'record-1',
        idempotency_key: 'transfer-002',
        request_hash: 'original-hash',
        response: { id: 'tx-003' },
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      }),
    );

    await expect(
      service.handle('transfer-002', 'different-hash', jest.fn()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('executes once and stores the response when key is new', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const execute = jest.fn().mockResolvedValue({
      id: 'tx-004',
      status: 'SUCCESS',
    });

    const result = await service.handle(
      'transfer-004',
      'new-hash',
      execute,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: 'tx-004',
      status: 'SUCCESS',
    });
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:transfer-004',
      expect.any(String),
      'EX',
      86400,
    );
  });
});
