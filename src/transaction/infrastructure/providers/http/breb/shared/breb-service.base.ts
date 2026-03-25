import { Logger } from '@nestjs/common';
import { throwHttpClientError } from './http-client-error.mapper';
import { Transaction } from '../../../../../domain/entity/transaction.entity';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../../../../domain/providers/external-transfer.service';
import { mapBrebResponseToTransferResult } from './breb-response.mapper';
import type { BrebHttp2Client } from '../client/breb-http2.client';
import { getCorrelationId } from 'src/common/utils/correlation.util';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';

export abstract class BrebAdapterBase implements ExternalTransferService {
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly brebClient: BrebHttp2Client,
    protected readonly metricsService: MetricsServicePort,
  ) {}

  async sendTransfer(
    transaction: Transaction,
  ): Promise<ExternalTransferResult> {
    try {
      this.logger.debug(
        `sendTransfer started | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id}`,
      );
      await this.metricsService.increment('breb_calls');
      const body = {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          description: transaction.description,
          receiver: {
            document: transaction.receiverDocument,
            documentType: transaction.receiverDocumentType,
            name: transaction.receiverName,
            account: transaction.receiverAccount,
            accountType: transaction.receiverAccountType,
          },
        },
      };
      const data = await this.brebClient.postJson(body);
      const result = mapBrebResponseToTransferResult(data);
      this.logger.log(
        `sendTransfer ok | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id} status=${result.status} traceId=${result.traceId ?? '-'}`,
      );
      return result;
    } catch (err) {
      await this.metricsService.increment('breb_errors');
      this.logger.error(
        `Error calling BREB | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id} error=${err}`,
      );
      throwHttpClientError(err);
      throw err;
    }
  }

  async getTransferById(id: string): Promise<unknown> {
    try {
      this.logger.debug(
        `getTransferById started | correlationId=${getCorrelationId() ?? '-'} id=${id}`,
      );
      await this.metricsService.increment('breb_calls');
      const data = await this.brebClient.getJson(id);
      this.logger.log(
        `getTransferById ok | correlationId=${getCorrelationId() ?? '-'} id=${id}`,
      );
      return data;
    } catch (err) {
      await this.metricsService.increment('breb_errors');
      this.logger.error(
        `Error calling BREB GET | correlationId=${getCorrelationId() ?? '-'} id=${id} error=${err}`,
      );
      throwHttpClientError(err);
      throw err;
    }
  }
}
