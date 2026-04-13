import { Currency } from 'src/transaction/domain/currency.enum';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

export interface GetTransferResponse {
  id: string;
  status: TransactionStatus;
  amount: number;
  currency: Currency;
  description: string;

  receiver: {
    document: string;
    documentType: string;
    name: string;
    account: string;
    accountType: string;
  };

  transactionDate: Date;
  finalizedAt?: Date;
}