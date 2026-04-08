import { ConflictException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Currency } from 'src/transaction/domain/currency.enum';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { TransactionRepositoryImpl } from 'src/transaction/infrastructure/providers/persistence/transaction.repository';
import type { TransactionDocument } from 'src/transaction/infrastructure/providers/persistence/transaction.schema';

describe('TransactionRepositoryImpl', () => {
  const makeTx = () =>
    new Transaction(
      'repo-tx',
      10,
      Currency.USD,
      'd',
      '1',
      'CC',
      'n',
      'a',
      'Ahorros',
      TransactionStatus.CREATED,
    );

  it('findById returns null when document not found', async () => {
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Model<TransactionDocument>;

    const repo = new TransactionRepositoryImpl(model);
    const result = await repo.findById('missing');

    expect(result).toBeNull();
    expect(model.findOne).toHaveBeenCalledWith({ id: 'missing' });
  });

  it('findById returns mapped Transaction when document exists', async () => {
    const doc = {
      id: 'repo-tx',
      amount: 10,
      currency: 'USD',
      description: 'd',
      receiverDocument: '1',
      receiverDocumentType: 'CC',
      receiverName: 'n',
      receiverAccount: 'a',
      receiverAccountType: 'Ahorros',
      status: TransactionStatus.CONFIRMED,
      transactionDate: new Date(),
    } as unknown as TransactionDocument;

    const model = {
      findOne: jest.fn().mockResolvedValue(doc),
    } as unknown as Model<TransactionDocument>;

    const repo = new TransactionRepositoryImpl(model);
    const result = await repo.findById('repo-tx');

    expect(result?.id).toBe('repo-tx');
    expect(result?.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('save persists via model.create', async () => {
    const created = { id: 'repo-tx' };
    const model = {
      create: jest.fn().mockResolvedValue(created),
    } as unknown as Model<TransactionDocument>;

    const repo = new TransactionRepositoryImpl(model);
    await repo.save(makeTx());

    expect(model.create).toHaveBeenCalledTimes(1);
  });

  it('save maps duplicate key to ConflictException', async () => {
    const model = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
    } as unknown as Model<TransactionDocument>;

    const repo = new TransactionRepositoryImpl(model);

    await expect(repo.save(makeTx())).rejects.toBeInstanceOf(ConflictException);
  });
});
