import { Injectable, Logger } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

export type MetricName =
  | 'transfer_created'
  | 'transfer_failed'
  | 'breb_calls'
  | 'breb_errors';

@Injectable()
export class PrometheusMetrics {
  private readonly logger = new Logger(PrometheusMetrics.name);
  private readonly registry = new Registry();
  private readonly counters: Record<MetricName, Counter>;

  constructor() {
    const registers = [this.registry];
    this.counters = {
      transfer_created: new Counter({
        name: 'transfer_created_total',
        help: 'Transfers persisted after successful BREB (Prometheus exposure; mirrors Redis increments).',
        registers,
      }),
      transfer_failed: new Counter({
        name: 'transfer_failed_total',
        help: 'Transfer failures (external or persistence; mirrors Redis increments).',
        registers,
      }),
      breb_calls: new Counter({
        name: 'breb_calls_total',
        help: 'BREB calls initiated (mirrors Redis increments).',
        registers,
      }),
      breb_errors: new Counter({
        name: 'breb_errors_total',
        help: 'Errors when calling BREB (mirrors Redis increments).',
        registers,
      }),
    };
  }

  recordAfterRedisOk(metric: MetricName): void {
    try {
      this.counters[metric].inc();
    } catch (err) {
      this.logger.warn(`Prometheus counter inc failed | metric=${metric} err=${String(err)}`);
    }
  }

  async getHttpPayload(): Promise<{ body: string; contentType: string }> {
    const body = await this.registry.metrics();
    return { body, contentType: this.registry.contentType };
  }
}
