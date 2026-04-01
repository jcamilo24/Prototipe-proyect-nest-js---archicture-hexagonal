import { Injectable, Logger } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

/** Mismas claves que `MetricsServicePort.increment` (contadores de negocio). */
export type MetricName =
  | 'transfer_created'
  | 'transfer_failed'
  | 'breb_calls'
  | 'breb_errors';

/**
 * Métricas para **scrape Prometheus** (`GET /metrics/prometheus`).
 * Independiente del snapshot JSON en Redis (`GET /metrics`): los contadores se
 * incrementan en proceso; Redis sigue siendo la fuente del endpoint JSON existente.
 */
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
        help: 'Transferencias persistidas tras BREB OK (exposición Prometheus; espejo de incrementos Redis).',
        registers,
      }),
      transfer_failed: new Counter({
        name: 'transfer_failed_total',
        help: 'Fallos en transferencia (externo o persistencia; espejo de incrementos Redis).',
        registers,
      }),
      breb_calls: new Counter({
        name: 'breb_calls_total',
        help: 'Llamadas iniciadas a BREB (espejo de incrementos Redis).',
        registers,
      }),
      breb_errors: new Counter({
        name: 'breb_errors_total',
        help: 'Errores al llamar BREB (espejo de incrementos Redis).',
        registers,
      }),
    };
  }

  /** Se llama solo cuando el incremento en Redis ya tuvo éxito (misma semántica). */
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
