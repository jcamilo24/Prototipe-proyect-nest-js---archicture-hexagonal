import { Controller, Get, Inject } from '@nestjs/common';
import { MetricsService } from '../../providers/http/metrics.service';

@Controller()
export class MetricsController {
  constructor(@Inject('MetricsService')
  private readonly metricsService: MetricsService,) {}

  @Get('/metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}