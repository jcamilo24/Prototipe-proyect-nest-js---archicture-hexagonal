import { Transaction } from '../entity/transaction.entity';
import { TransactionStatus } from '../transaction-status.enum';

export type ExternalTransferService = {
  sendTransfer(transaction: Transaction): Promise<ExternalTransferResult>;
}

export type ExternalTransferResult = {
  externalId: string;
  status: TransactionStatus;
  traceId: string;
  qrCodeId?: string;
  eventDate?: string;
}
