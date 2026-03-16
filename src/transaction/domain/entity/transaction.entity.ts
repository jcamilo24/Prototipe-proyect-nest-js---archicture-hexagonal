import { TransactionStatus } from '../transaction-status.enum';
import { validateFinalization } from '../transaction-status.validator';

export class Transaction {
  private _status: TransactionStatus;
  private _finalizedAt: Date | null = null;

  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly description: string,
    public readonly receiverDocument: string,
    public readonly receiverDocumentType: string,
    public readonly receiverName: string,
    public readonly receiverAccount: string,
    public readonly receiverAccountType: string,
    status: TransactionStatus,
    public readonly transactionDate: Date = new Date(),
  ) {
    this._status = status;
  }

  get status(): TransactionStatus {
    return this._status;
  }

  get finalizedAt(): Date | null {
    return this._finalizedAt;
  }

  applyExternalResult(resultStatus: TransactionStatus): void {
    validateFinalization(this._status, resultStatus, this.id);
    this._status = resultStatus;
    this._finalizedAt = new Date();
  }
}
