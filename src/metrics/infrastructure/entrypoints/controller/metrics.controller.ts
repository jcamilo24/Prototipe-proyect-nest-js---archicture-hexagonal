import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { MetricsService } from '../../providers/http/metrics.service';
import { PrometheusMetrics } from '../../prometheus/prometheus.metrics';

@Controller()
export class MetricsController {
  constructor(
    @Inject('MetricsService')
    private readonly metricsService: MetricsService,
    private readonly PrometheusMetrics: PrometheusMetrics,
  ) {}

  /** Redis */
  @Get('/metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  /** Docker Prometheus; does not replace `/metrics` JSON. */
  @Get('/metrics/prometheus')
  async getPrometheusMetrics(
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const { body, contentType } =
      await this.PrometheusMetrics.getHttpPayload();
    void res.header('Content-Type', contentType).send(body);
  }
}