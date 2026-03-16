import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { throwPersistenceError } from './persistence-error.mapper';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../../domain/providers/transaction.repository';
import { TransactionDocument } from './transaction.schema';

@Injectable()
export class TransactionRepositoryImpl implements TransactionRepository {
  private readonly logger = new Logger(TransactionRepositoryImpl.name);

  constructor(
    @InjectModel(TransactionDocument.name)
    private readonly model: Model<TransactionDocument>,
  ) {}

  async save(transaction: Transaction): Promise<void> {
    this.logger.log(
      `save started | transactionId=${transaction.id} status=${transaction.status}`,
    );

    const payload = {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      receiverDocument: transaction.receiverDocument,
      receiverDocumentType: transaction.receiverDocumentType,
      receiverName: transaction.receiverName,
      receiverAccount: transaction.receiverAccount,
      receiverAccountType: transaction.receiverAccountType,
      status: transaction.status,
      finalizedAt: transaction.finalizedAt ?? undefined,
      transactionDate: transaction.transactionDate ?? new Date(),
    };

    try {
      const created = await this.model.create(payload);
      if (!created) {
        throw new InternalServerErrorException(
          `create() returned no document`,
          { cause: new Error('Mongoose create returned null/undefined') },
        );
      }
      this.logger.log(`save completed | transactionId=${transaction.id}`);
    } catch (err) {
      throwPersistenceError(err, `(transactionId=${transaction.id})`);
    }
  }
}
