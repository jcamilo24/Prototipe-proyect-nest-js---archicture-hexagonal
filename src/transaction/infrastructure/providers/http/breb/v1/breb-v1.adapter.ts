import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrebAdapterBase } from '../shared/breb-service.base';
import {
  HTTP2_CLIENT_V1,
  type Http2Client,
} from '../../client/http2.client';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';

@Injectable()
export class BrebV1Adapter extends BrebAdapterBase {
  protected readonly logger = new Logger(BrebV1Adapter.name);

  constructor(
    @Inject(HTTP2_CLIENT_V1)
    brebClient: Http2Client,
    @Inject('MetricsService')
    metricsService: MetricsServicePort,
  ) {
    super(brebClient, metricsService);
  }
}
