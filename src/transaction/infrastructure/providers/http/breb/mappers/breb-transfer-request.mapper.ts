import { Transaction } from '../../../../../domain/entity/transaction.entity';

export function mapTransactionToBrebTransferPayload(
  transaction: Transaction,
): Record<string, unknown> {
  return {
    transaction: {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      receiver: {
        document: transaction.receiverDocument,
        documentType: transaction.receiverDocumentType,
        name: transaction.receiverName,
        account: transaction.receiverAccount,
        accountType: transaction.receiverAccountType,
      },
    },
  };
}
