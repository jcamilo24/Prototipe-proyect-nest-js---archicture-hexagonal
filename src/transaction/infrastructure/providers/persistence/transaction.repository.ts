import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { throwPersistenceError } from '../../../../common/errors/persistence-error.mapper';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type { TransactionRepository } from '../../../domain/providers/transaction.repository';
import { TransactionDocument } from './transaction.schema';

@Injectable()
export class TransactionRepositoryImpl implements TransactionRepository {
  constructor(
    @InjectModel(TransactionDocument.name)
    private readonly model: Model<TransactionDocument>,
  ) {}

  async save(transaction: Transaction): Promise<void> {
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
    } catch (err) {
      throwPersistenceError(
        err,
        `(transactionId=${transaction.id})`,
      );
    }
  }
}
