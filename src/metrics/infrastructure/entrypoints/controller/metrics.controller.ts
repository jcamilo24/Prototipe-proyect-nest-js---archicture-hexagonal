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

  /** Snapshot JSON persistido en Redis (comportamiento existente). */
  @Get('/metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  /** Texto plano para scrape Prometheus; no sustituye `/metrics` JSON. */
  @Get('/metrics/prometheus')
  async getPrometheusMetrics(
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const { body, contentType } =
      await this.PrometheusMetrics.getHttpPayload();
    void res.header('Content-Type', contentType).send(body);
  }
}