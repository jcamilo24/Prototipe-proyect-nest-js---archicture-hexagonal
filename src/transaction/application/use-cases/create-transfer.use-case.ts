import { Logger } from '@nestjs/common';
import { resolveBrebApiVersion } from '../../domain/breb-api-version';
import { Transaction } from '../../domain/entity/transaction.entity';
import { TransferFeeCalculator } from '../../domain/transfer-fee.calculator';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../domain/providers/external-transfer.service';
import {
  isUnsupportedCurrencyError,
  throwUseCaseBadRequest,
  throwUseCaseError,
} from '../errors/use-case-error.helper';
import { getCorrelationId } from 'src/common/utils/correlation.util';
import { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';

export type CreateTransferResult = {
  transaction: Transaction;
  externalResponse: ExternalTransferResult;
}

export class CreateTransferUseCase {
  private readonly logger = new Logger(CreateTransferUseCase.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly externalTransferV1: ExternalTransferService,
    private readonly externalTransferV2: ExternalTransferService,
    private readonly metricsService: MetricsServicePort,
    private readonly transferFeeCalculator: TransferFeeCalculator,
  ) {}

  async execute(
    transaction: Transaction,
    brebApiVersionRaw: string,
  ): Promise<CreateTransferResult> {
    const brebVersion = resolveBrebApiVersion(brebApiVersionRaw);
    const externalTransferService =
      brebVersion === 'v2'
        ? this.externalTransferV2
        : this.externalTransferV1;

    let externalResponse: ExternalTransferResult;
    try {
      const fee = this.transferFeeCalculator.calculate(
        transaction.id,
        transaction.amount,
        transaction.currency,
      );
      transaction.setFee(fee);
      this.logger.debug(
        `Calling external transfer | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id} brebVersion=${brebVersion}`,
      );
      externalResponse =
        await externalTransferService.sendTransfer(transaction);
      this.logger.log(
        `External transfer ok | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id} status=${externalResponse.status} traceId=${externalResponse.traceId ?? '-'}`,
      );
    } catch (err) {
      if (isUnsupportedCurrencyError(err)) {
        throwUseCaseBadRequest(err);
      }
      await this.metricsService.increment('transfer_failed');
      throwUseCaseError(err, `(step: external transfer)`);
    }
    transaction.applyExternalResult(externalResponse.status);
    try {
      this.logger.debug(`Persisting transaction | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id}`);
      await this.transactionRepository.save(transaction);
      this.logger.log(`Persist ok | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id}`);
      await this.metricsService.increment('transfer_created');
    } catch (err) {
      await this.metricsService.increment('transfer_failed');
      throwUseCaseError(err, `(step: persist)`);
    }
    this.logger.log(`Execute completed | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id}`);
    return {
      transaction,
      externalResponse,
    };
  }
}
