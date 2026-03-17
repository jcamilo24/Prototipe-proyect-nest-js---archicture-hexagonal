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
import { TransactionMapper } from './transaction.mapper';

@Injectable()
export class TransactionRepositoryImpl implements TransactionRepository {
  private readonly logger = new Logger(TransactionRepositoryImpl.name);

  constructor(
    @InjectModel(TransactionDocument.name)
    private readonly model: Model<TransactionDocument>,
  ) {}

 async findById(id: string): Promise<Transaction | null> {
  this.logger.log(`findById started | id=${id}`);

  try {
    const doc = await this.model.findOne({ id });

    if (!doc) {
      this.logger.log(`Transfer not found | id=${id}`);
      return null;
    }

    this.logger.log(`Transfer found | id=${id}`);

    return TransactionMapper.toDomain(doc);

  } catch (err) {
    throwPersistenceError(err, `(findById id=${id})`);
  }
}

  async save(transaction: Transaction): Promise<void> {
    this.logger.log(
      `save started | transactionId=${transaction.id} status=${transaction.status}`,
    );

    const payload = TransactionMapper.toPersistence(transaction);

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
