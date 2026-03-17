import { Logger, NotFoundException } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';

export class GetTransferByIdUseCase {
  private readonly logger = new Logger(GetTransferByIdUseCase.name);

  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(id: string): Promise<Transaction> {
    this.logger.log(`Getting transfer by id | id=${id}`);

    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      this.logger.log(`Transfer not found | id=${id}`);
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    this.logger.log(`Transfer found | id=${id}`);
    return transaction;
  }
}