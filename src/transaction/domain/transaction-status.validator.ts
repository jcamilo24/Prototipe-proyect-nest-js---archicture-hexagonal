import { TransactionStatus } from './transaction-status.enum';

export function validateFinalization(
  currentStatus: TransactionStatus,
  resultStatus: TransactionStatus,
  transactionId: string,
): void {
  if (currentStatus !== TransactionStatus.CREATED) {
    throw new Error(
      `Transaction ${transactionId} cannot be finalized: current status is ${currentStatus}, expected PENDING`,
    );
  }
  if (
    resultStatus !== TransactionStatus.SUCCESS &&
    resultStatus !== TransactionStatus.FAILED
  ) {
    throw new Error(
      `Invalid final status for transaction ${transactionId}: ${resultStatus}. Expected SUCCESS or FAILED`,
    );
  }
}
