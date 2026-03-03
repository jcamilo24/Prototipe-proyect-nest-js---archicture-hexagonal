import { Transaction } from '../entity/transaction.entity';

export interface ExternalTransferService {
  sendTransfer(transaction: Transaction): Promise<ExternalTransferResult>;
}

export interface ExternalTransferResult {
  externalId: string;
  status: string;
  traceId: string;
  qrCodeId?: string;
  eventDate?: string;
}
