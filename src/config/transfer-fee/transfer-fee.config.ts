import { ConfigService } from '@nestjs/config';
import type { TransferFeeRates } from 'src/transaction/domain/transfer-fee.calculator';

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
