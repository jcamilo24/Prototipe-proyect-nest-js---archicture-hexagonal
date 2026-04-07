import { UnsupportedTransactionCurrencyError } from '../../application/errors/unsupported-transaction-currency.error';
import { TransactionStatus } from '../transaction-status.enum';
import { validateFinalization } from '../transaction-status.validator';

export class Transaction {
  private _status: TransactionStatus;
  private _finalizedAt: Date | null = null;
  private _fee: number = 0;

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

  applyFee(): void {
    if (this.currency !== 'COP' && this.currency !== 'USD') {
      throw new UnsupportedTransactionCurrencyError(this.id, this.currency);
    }

    if (this._fee > 0) return;
  
    if (this.currency === 'COP') {
      this._fee = Math.round(this.amount * 0.01 * 100) / 100; //redondear para ser mas exactos
      return;
    }
  
    if (this.currency === 'USD') {
      this._fee = Math.round(this.amount * 0.02 * 100) / 100;//redondear para ser mas exactos
      return;
    }
  }
}
