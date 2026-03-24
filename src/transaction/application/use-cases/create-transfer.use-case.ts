import { Logger } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../domain/providers/external-transfer.service';
import { throwUseCaseError } from '../errors/use-case-error.helper';
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
    private readonly externalTransferService: ExternalTransferService,
    private readonly metricsService: MetricsServicePort,
  ) {}

  async execute(transaction: Transaction): Promise<CreateTransferResult> {
    let externalResponse: ExternalTransferResult;
    try {
      this.logger.debug(`Calling external transfer | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id}`);
      externalResponse =
        await this.externalTransferService.sendTransfer(transaction);
      this.logger.log(
        `External transfer ok | correlationId=${getCorrelationId() ?? '-'} transactionId=${transaction.id} status=${externalResponse.status} traceId=${externalResponse.traceId ?? '-'}`,
      );
    } catch (err) {
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
