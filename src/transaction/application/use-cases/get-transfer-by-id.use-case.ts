import { Logger } from '@nestjs/common';
import { Transaction } from '../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../domain/providers/transaction.repository';
import { getCorrelationId } from 'src/common/utils/correlation.util';

export class GetTransferByIdUseCase {
  private readonly logger = new Logger(GetTransferByIdUseCase.name);

  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(id: string): Promise<Transaction | null> {
    this.logger.debug(`Getting transfer by id | correlationId=${getCorrelationId() ?? '-'} id=${id}`);

    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      this.logger.warn(`Transfer not found | correlationId=${getCorrelationId() ?? '-'} id=${id}`);
      return null;
    }

    this.logger.log(`Transfer found | correlationId=${getCorrelationId() ?? '-'} id=${id}`);
    return transaction;
  }
}