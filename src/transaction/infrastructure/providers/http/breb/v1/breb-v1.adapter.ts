import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrebAdapterBase } from '../shared/breb-service.base';
import {
  BREB_HTTP2_CLIENT_V1,
  type BrebHttp2Client,
} from '../client/breb-http2.client';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';

@Injectable()
export class BrebV1Adapter extends BrebAdapterBase {
  protected readonly logger = new Logger(BrebV1Adapter.name);

  constructor(
    @Inject(BREB_HTTP2_CLIENT_V1)
    brebClient: BrebHttp2Client,
    @Inject('MetricsService')
    metricsService: MetricsServicePort,
  ) {
    super(brebClient, metricsService);
  }
}
