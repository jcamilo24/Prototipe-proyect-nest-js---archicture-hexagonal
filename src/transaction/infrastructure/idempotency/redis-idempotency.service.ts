import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { IdempotencyService } from '../../domain/providers/idempotency.service';
import {
  createIdempotencyRecord,
  IdempotencyRecord,
} from './idempotency-record';

@Injectable()
export class RedisIdempotencyService implements IdempotencyService {
  private readonly keyPrefix: string;
  private readonly ttlSeconds: number;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.keyPrefix =
      this.configService.get<string>('IDEMPOTENCY_KEY_PREFIX') ?? 'idempotency';
    this.ttlSeconds = Number(
      this.configService.get<string>('IDEMPOTENCY_TTL_SECONDS') ?? '86400',
    );
  }

  async handle<T>(
    key: string,
    requestHash: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const stored = await this.redis.get(redisKey);

    if (stored) {
      const record = JSON.parse(stored) as IdempotencyRecord<T>;

      if (record.request_hash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key reused with different payload',
        );
      }

      return record.response;
    }

    const response = await execute();
    const record = createIdempotencyRecord(key, requestHash, response);

    await this.redis.set(
      redisKey,
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
    );

    return response;
  }
}
