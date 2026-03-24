import { Module } from '@nestjs/common';
import { MetricsService } from './infrastructure/providers/http/metrics.service';
import { MetricsController } from './infrastructure/entrypoints/controller/metrics.controller';
import { RedisModule } from 'src/config/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [MetricsController],
  providers: [
    {
      provide: 'MetricsService',
      useClass: MetricsService,
    },
  ],
  exports: [
    'MetricsService', 
  ],
})
export class MetricsModule {}