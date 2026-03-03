import { Inject, Injectable } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../domain/providers/external-transfer.service';

export interface CreateTransferResult {
  transaction: Transaction;
  externalResponse: ExternalTransferResult;
}

@Injectable()
export class CreateTransferUseCase {
  constructor(
    @Inject('TransactionRepository')
    private readonly transactionRepository: TransactionRepository,
    @Inject('ExternalTransferService')
    private readonly externalTransferService: ExternalTransferService,
  ) {}

  async execute(transaction: Transaction): Promise<CreateTransferResult> {
    const externalResponse =
      await this.externalTransferService.sendTransfer(transaction);

    transaction.status = externalResponse.status;

    await this.transactionRepository.save(transaction);

    return {
      transaction,
      externalResponse,
    };
  }
}
