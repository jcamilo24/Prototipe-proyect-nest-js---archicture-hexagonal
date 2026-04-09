import { Currency } from './currency.enum';
import { UnsupportedCurrencyException } from './unsupported-currency.exception';

/** Tasas por moneda (inyectadas vía config / env en la capa de aplicación). */
export interface TransferFeeRates {
  copRate: number;
  usdRate: number;
}

/**
 * Regla de comisión operativa por moneda (dominio, sin dependencias de framework).
 */
export class TransferFeeCalculator {
  constructor(private readonly rates: TransferFeeRates) {}

  calculate(
    transactionId: string,
    amount: number,
    currency: Currency,
  ): number {
    switch (currency) {
      case Currency.COP:
        return Math.round(amount * this.rates.copRate * 100) / 100;
      case Currency.USD:
        return Math.round(amount * this.rates.usdRate * 100) / 100;
      default:
        throw new UnsupportedCurrencyException(
          transactionId,
          String(currency),
        );
    }
  }
}
