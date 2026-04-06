import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrebAdapterBase } from '../shared/breb-service.base';
import {
  HTTP2_CLIENT_V2,
  type Http2Client,
} from '../../client/http2.client';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';

@Injectable()
export class BrebV2Adapter extends BrebAdapterBase {
  protected readonly logger = new Logger(BrebV2Adapter.name);

  constructor(
    @Inject(HTTP2_CLIENT_V2)
    brebClient: Http2Client,
    @Inject('MetricsService')
    metricsService: MetricsServicePort,
  ) {
    super(brebClient, metricsService);
  }
}
