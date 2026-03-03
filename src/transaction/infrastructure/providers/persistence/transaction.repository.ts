import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    await this.model.create({
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
    });
  }
}
