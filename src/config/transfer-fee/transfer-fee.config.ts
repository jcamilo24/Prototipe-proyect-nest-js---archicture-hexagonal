import { ConfigService } from '@nestjs/config';
import type { TransferFeeRates } from 'src/transaction/domain/transfer-fee.calculator';

/**
 * Lee solo env (obligatorias). Valores como porcentaje entero (ej. 1 = 1%, 2 = 2%).
 * - TRANSFER_FEE_RATE_COP
 * - TRANSFER_FEE_RATE_USD
 */
export function resolveTransferFeeRates(
  config: ConfigService,
): TransferFeeRates {
  const copPct = config.getOrThrow<string>('TRANSFER_FEE_RATE_COP');
  const usdPct = config.getOrThrow<string>('TRANSFER_FEE_RATE_USD');
  return {
    copRate: Number(copPct) / 100,
    usdRate: Number(usdPct) / 100,
  };
}
