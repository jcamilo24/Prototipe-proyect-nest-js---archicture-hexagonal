import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { TransactionMapper } from 'src/transaction/infrastructure/providers/persistence/transaction.mapper';
import type { TransactionDocument } from 'src/transaction/infrastructure/providers/persistence/transaction.schema';

describe('TransactionMapper', () => {
  const txDate = new Date('2025-03-01T00:00:00.000Z');
  const fin = new Date('2025-03-02T00:00:00.000Z');

  it('toDomain maps document to Transaction entity', () => {
    const doc = {
      id: 't1',
      amount: 100,
      currency: 'USD',
      description: 'd',
      receiverDocument: '1',
      receiverDocumentType: 'CC',
      receiverName: 'n',
      receiverAccount: 'acc',
      receiverAccountType: 'Ahorros',
      status: TransactionStatus.CONFIRMED,
      transactionDate: txDate,
      finalizedAt: fin,
    } as unknown as TransactionDocument;

    const entity = TransactionMapper.toDomain(doc);

    expect(entity.id).toBe('t1');
    expect(entity.status).toBe(TransactionStatus.CONFIRMED);
    expect(entity.finalizedAt).toEqual(fin);
  });

  it('toPersistence maps entity fields for Mongoose create', () => {
    const entity = new Transaction(
      't2',
      200,
      'COP',
      'desc',
      'doc',
      'CC',
      'Name',
      'acc',
      'Ahorros',
      TransactionStatus.CREATED,
      txDate,
      null,
    );

    const payload = TransactionMapper.toPersistence(entity);

    expect(payload).toMatchObject({
      id: 't2',
      amount: 200,
      currency: 'COP',
      status: TransactionStatus.CREATED,
    });
    expect(payload.finalizedAt).toBeUndefined();
    expect(payload.transactionDate).toEqual(txDate);
  });
});
