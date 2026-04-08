import { Currency } from './currency.enum';
import { UnsupportedCurrencyException } from './unsupported-currency.exception';

/**
 * Regla de comisión operativa por moneda (dominio, sin dependencias de framework).
 * COP: 1%, USD: 2%, redondeo a 2 decimales como en la entidad previa.
 */
export class TransferFeeCalculator {
  calculate(
    transactionId: string,
    amount: number,
    currency: Currency,
  ): number {
    switch (currency) {
      case Currency.COP:
        return Math.round(amount * 0.01 * 100) / 100;
      case Currency.USD:
        return Math.round(amount * 0.02 * 100) / 100;
      default:
        throw new UnsupportedCurrencyException(
          transactionId,
          String(currency),
        );
    }
  }
}
