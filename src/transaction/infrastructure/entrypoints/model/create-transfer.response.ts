export interface CreateTransferResponse {
  id: string;
  status: string;
  endToEndId: string;
  qrCodeId?: string;
  properties: {
    eventDate?: string;
    traceId: string;
  };
}
