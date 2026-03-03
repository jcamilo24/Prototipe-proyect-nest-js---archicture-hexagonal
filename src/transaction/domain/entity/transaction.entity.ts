export class Transaction {
  constructor(
    public id: string,
    public amount: number,
    public currency: string,
    public description: string,
    public receiverDocument: string,
    public receiverDocumentType: string,
    public receiverName: string,
    public receiverAccount: string,
    public receiverAccountType: string,
    public status: string,
  ) {}
}
