import { Logger } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../domain/providers/external-transfer.service';
import { throwUseCaseError } from '../errors/use-case-error.helper';

export type CreateTransferResult = {
  transaction: Transaction;
  externalResponse: ExternalTransferResult;
}

export class CreateTransferUseCase {
  private readonly logger = new Logger(CreateTransferUseCase.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly externalTransferService: ExternalTransferService,
  ) {}

  async execute(transaction: Transaction): Promise<CreateTransferResult> {
    let externalResponse: ExternalTransferResult;
    try {
      this.logger.log(`Calling external transfer | transactionId=${transaction.id}`);
      externalResponse =
        await this.externalTransferService.sendTransfer(transaction);
      this.logger.log(
        `External transfer ok | transactionId=${transaction.id} status=${externalResponse.status} traceId=${externalResponse.traceId ?? '-'}`,
      );
    } catch (err) {
      throwUseCaseError(err, `(step: external transfer)`);
    }
    transaction.applyExternalResult(externalResponse.status);
    try {
      this.logger.log(`Persisting transaction | transactionId=${transaction.id}`);
      await this.transactionRepository.save(transaction);
      this.logger.log(`Persist ok | transactionId=${transaction.id}`);
    } catch (err) {
      throwUseCaseError(err, `(step: persist)`);
    }
    this.logger.log(`Execute completed | transactionId=${transaction.id}`);
    return {
      transaction,
      externalResponse,
    };
  }
}
