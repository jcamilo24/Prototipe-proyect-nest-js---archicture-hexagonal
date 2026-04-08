import { Currency } from '../currency.enum';
import { TransactionStatus } from '../transaction-status.enum';
import { validateFinalization } from '../transaction-status.validator';

export class Transaction {
  private _status: TransactionStatus;
  private _finalizedAt: Date | null = null;
  private _fee: number = 0;

  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: Currency,
    public readonly description: string,
    public readonly receiverDocument: string,
    public readonly receiverDocumentType: string,
    public readonly receiverName: string,
    public readonly receiverAccount: string,
    public readonly receiverAccountType: string,
    status: TransactionStatus,
    public readonly transactionDate: Date = new Date(),
    finalizedAt?: Date | null,
    fee: number = 0,
  ) {
    this._status = status;
    this._finalizedAt = finalizedAt ?? null;
    this._fee = fee ?? 0;
  }

  get status(): TransactionStatus {
    return this._status;
  }

  get fee(): number {
    return this._fee;
  }

  get finalizedAt(): Date | null {
    return this._finalizedAt;
  }

  applyExternalResult(resultStatus: TransactionStatus): void {
    validateFinalization(this._status, resultStatus, this.id);
    this._status = resultStatus;
    this._finalizedAt = new Date();
  }

  setFee(fee: number): void {
    if (this._fee > 0) return;
    this._fee = fee;
  }
}
