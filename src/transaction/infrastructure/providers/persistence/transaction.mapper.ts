import { Transaction } from '../../../domain/entity/transaction.entity';
import { TransactionDocument } from './transaction.schema';

export class TransactionMapper {

  static toDomain(doc: TransactionDocument): Transaction {
    return new Transaction(
      doc.id,
      doc.amount,
      doc.currency,
      doc.description,
      doc.receiverDocument,
      doc.receiverDocumentType,
      doc.receiverName,
      doc.receiverAccount,
      doc.receiverAccountType,
      doc.status,
      doc.transactionDate ?? new Date(),
      doc.finalizedAt ?? null,
      doc.fee ?? 0,
    );
  }

  static toPersistence(entity: Transaction) {
    return {
      id: entity.id,
      amount: entity.amount,
      currency: entity.currency,
      description: entity.description,
      receiverDocument: entity.receiverDocument,
      receiverDocumentType: entity.receiverDocumentType,
      receiverName: entity.receiverName,
      receiverAccount: entity.receiverAccount,
      receiverAccountType: entity.receiverAccountType,
      status: entity.status,
      fee: entity.fee ?? 0,
      finalizedAt: entity.finalizedAt ?? undefined,
      transactionDate: entity.transactionDate ?? new Date(),
    };
  }
}