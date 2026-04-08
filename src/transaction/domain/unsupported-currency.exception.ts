/**
 * Fallo de validación de moneda (dominio). La capa de aplicación puede mapearla a HTTP 400.
 */
export class UnsupportedCurrencyException extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly currency: string,
  ) {
    super(
      `Unsupported currency for transaction ${transactionId}: ${currency}`,
    );
    this.name = 'UnsupportedCurrencyException';
    Object.setPrototypeOf(this, UnsupportedCurrencyException.prototype);
  }
}
