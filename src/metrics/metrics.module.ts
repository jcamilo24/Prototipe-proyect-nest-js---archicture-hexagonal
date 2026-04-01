import { Module } from '@nestjs/common';
import { MetricsService } from './infrastructure/providers/http/metrics.service';
import { MetricsController } from './infrastructure/entrypoints/controller/metrics.controller';
import { RedisModule } from 'src/config/redis/redis.module';
import { PrometheusMetrics } from './infrastructure/prometheus/prometheus.metrics';

@Module({
  imports: [RedisModule],
  controllers: [MetricsController],
  providers: [
    PrometheusMetrics,
    {
      provide: 'MetricsService',
      useClass: MetricsService,
    },
  ],
  exports: [
    'MetricsService',
    PrometheusMetrics,
  ],
})
export class MetricsModule {}