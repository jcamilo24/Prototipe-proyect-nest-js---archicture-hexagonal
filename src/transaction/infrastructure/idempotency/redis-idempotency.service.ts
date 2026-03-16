import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { IdempotencyService } from '../../domain/providers/idempotency.service';
import {
  createIdempotencyRecord,
  IdempotencyRecord,
} from './idempotency-record';

@Injectable()
export class RedisIdempotencyService implements IdempotencyService {
  private readonly logger = new Logger(RedisIdempotencyService.name);
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
    this.logger.log(`Idempotency check | key=${key} redisKey=${redisKey}`);

    const stored = await this.redis.get(redisKey);

    if (stored) {
      const record = JSON.parse(stored) as IdempotencyRecord<T>;

      if (record.request_hash !== requestHash) {
        this.logger.warn(
          `Idempotency conflict | key=${key} (same key, different payload)`,
        );
        throw new ConflictException(
          'Idempotency-Key reused with different payload',
        );
      }

      this.logger.log(`Idempotency cache hit | key=${key} -> returning cached`);
      return record.response;
    }

    this.logger.log(`Idempotency cache miss | key=${key} -> executing use case`);
    const response = await execute();
    const record = createIdempotencyRecord(key, requestHash, response);

    await this.redis.set(
      redisKey,
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
    );
    this.logger.log(`Idempotency stored | key=${key} ttl=${this.ttlSeconds}s`);

    return response;
  }
}
