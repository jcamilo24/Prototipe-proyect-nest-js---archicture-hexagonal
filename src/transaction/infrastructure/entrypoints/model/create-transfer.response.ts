import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

export interface CreateTransferResponse {
  id: string;
  status: TransactionStatus;
  endToEndId: string;
  qrCodeId?: string;
  properties: {
    eventDate?: string;
    traceId: string;
  };
}
