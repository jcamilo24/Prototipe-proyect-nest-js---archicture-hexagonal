import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../domain/providers/external-transfer.service';
import { throwUseCaseError } from '../../../common/errors/use-case-error.mapper';

export interface CreateTransferResult {
  transaction: Transaction;
  externalResponse: ExternalTransferResult;
}

export class CreateTransferUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly externalTransferService: ExternalTransferService,
  ) {}

  async execute(transaction: Transaction): Promise<CreateTransferResult> {
    let externalResponse: ExternalTransferResult;

    try {
      externalResponse =
        await this.externalTransferService.sendTransfer(transaction);
    } catch (err) {
      throwUseCaseError(
        err,
        `(step: external transfer)`,
      );
    }

    transaction.status = externalResponse.status;

    try {
      await this.transactionRepository.save(transaction);
    } catch (err) {
      throwUseCaseError(err, `(step: persist)`);
    }

    return {
      transaction,
      externalResponse,
    };
  }
}
