/**
 * Fallo de validación de moneda (dominio).
 * El adaptador de entrada HTTP (filtro de excepciones) la traduce a respuesta 400.
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
