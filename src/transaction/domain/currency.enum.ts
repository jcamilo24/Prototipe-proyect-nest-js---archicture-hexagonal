import { UnsupportedCurrencyException } from './unsupported-currency.exception';

export enum Currency {
  COP = 'COP',
  USD = 'USD',
}

export function parseTransactionCurrency(
  transactionId: string,
  raw: string,
): Currency {
  if (Object.values(Currency).includes(raw as Currency)) {
    return raw as Currency;
  }
  throw new UnsupportedCurrencyException(transactionId, raw);
}
