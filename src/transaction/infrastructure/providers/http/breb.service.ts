import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwHttpClientError } from './http-client-error.mapper';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../../domain/providers/external-transfer.service';
import { mapBrebResponseToTransferResult } from './breb-response.mapper';
import { BREB_HTTP2_CLIENT, type BrebHttp2Client } from './breb-http2.client';
import { createBrebCircuitBreaker, type BrebCircuitBreakerInstance } from './breb-circuit-breaker.factory';
import { getBrebCircuitBreakerOptions } from './breb-circuit-breaker.options';

@Injectable()
export class BrebAdapter implements ExternalTransferService {
  private readonly logger = new Logger(BrebAdapter.name);
  private readonly breaker: BrebCircuitBreakerInstance;

  constructor(
    @Inject(BREB_HTTP2_CLIENT)
    private readonly brebClient: BrebHttp2Client,
    private readonly configService: ConfigService,
  ) {
    const options = getBrebCircuitBreakerOptions(this.configService);
    this.breaker = createBrebCircuitBreaker(
      this.callBreb.bind(this),
      this.logger,
      options,
    );
  }

  async sendTransfer(
    transaction: Transaction,
  ): Promise<ExternalTransferResult> {
    try {
      return await this.breaker.fire(transaction);
    } catch (err) {
      this.logger.error(`Error calling BREB | transactionId=${transaction.id} error=${err}`);
      throwHttpClientError(err);
      throw err;
    }
  }

  async getTransferById(id: string): Promise<unknown> {
    try {
      this.logger.log(`getTransferById started | id=${id}`);
      const data = await this.brebClient.getJson(id);
      this.logger.log(`getTransferById ok | id=${id}`);
      return data;
    } catch (err) {
      this.logger.error(`Error calling BREB GET | id=${id} error=${err}`);
      throwHttpClientError(err);
      throw err;
    }
  }

  private async callBreb(
    transaction: Transaction,
  ): Promise<ExternalTransferResult> {
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

    this.logger.log(
      `sendTransfer started | transactionId=${transaction.id}`,
    );
    const data = await this.brebClient.postJson(body);
    const result = mapBrebResponseToTransferResult(data);
    this.logger.log(
      `sendTransfer ok | transactionId=${transaction.id} status=${result.status} traceId=${result.traceId ?? '-'}`,
    );
    return result;
  }
}
