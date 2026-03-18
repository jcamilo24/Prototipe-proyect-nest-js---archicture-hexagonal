import { Logger, NotFoundException } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import { getCorrelationId } from 'src/common/utils/correlation.util';

export class GetTransferByIdUseCase {
  private readonly logger = new Logger(GetTransferByIdUseCase.name);

  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(id: string): Promise<Transaction> {
    this.logger.log(`Getting transfer by id | correlationId=${getCorrelationId() ?? '-'} id=${id}`);

    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      this.logger.log(`Transfer not found | correlationId=${getCorrelationId() ?? '-'} id=${id}`);
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    this.logger.log(`Transfer found | correlationId=${getCorrelationId() ?? '-'} id=${id}`);
    return transaction;
  }
}