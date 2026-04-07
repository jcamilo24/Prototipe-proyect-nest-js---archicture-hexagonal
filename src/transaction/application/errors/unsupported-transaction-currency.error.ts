export class UnsupportedTransactionCurrencyError extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly currency: string,
  ) {
    super(
      `Unsupported currency for transaction ${transactionId}: ${currency}`,
    );
    this.name = 'UnsupportedTransactionCurrencyError';
    Object.setPrototypeOf(this, UnsupportedTransactionCurrencyError.prototype);
  }
}
