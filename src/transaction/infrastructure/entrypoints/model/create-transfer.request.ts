export interface CreateTransferRequest {
  transaction: {
    id: string;
    amount: number;
    currency: string;
    description: string;
    receiver: {
      document: string;
      documentType: string;
      name: string;
      account: string;
      accountType: string;
    };
  };
}
