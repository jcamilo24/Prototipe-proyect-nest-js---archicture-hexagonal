import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MetricsServicePort } from '../../../domain/providers/metrics.service.provider';
import { PrometheusMetrics } from '../../prometheus/prometheus.metrics';

@Injectable()
export class MetricsService implements MetricsServicePort {
  private readonly logger = new Logger(MetricsService.name);
  private readonly redisKey: string;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly PrometheusMetrics: PrometheusMetrics,
  ) {
    this.redisKey = this.configService.get<string>('METRICS_REDIS_KEY') ?? 'metrics:counters';
  }

  async increment(
    metric: 'transfer_created' | 'transfer_failed' | 'breb_calls' | 'breb_errors',
  ): Promise<void> {
    try {
      await this.redis.hincrby(this.redisKey, metric, 1);
      this.PrometheusMetrics.recordAfterRedisOk(metric);
    } catch (err) {
      this.logger.warn(`Failed to increment metric ${metric}: ${String(err)}`);
    }
  }

  async getMetrics(): Promise<{
    transfer_created: number;
    transfer_failed: number;
    breb_calls: number;
    breb_errors: number;
  }> {
    try {
      const data = await this.redis.hgetall(this.redisKey);
      return {
        transfer_created: Number(data.transfer_created ?? '0'),
        transfer_failed: Number(data.transfer_failed ?? '0'),
        breb_calls: Number(data.breb_calls ?? '0'),
        breb_errors: Number(data.breb_errors ?? '0'),
      };
    } catch (err) {
      this.logger.warn(`Failed to read metrics from Redis: ${String(err)}`);
      return {
        transfer_created: 0,
        transfer_failed: 0,
        breb_calls: 0,
        breb_errors: 0,
      };
    }
  }
}