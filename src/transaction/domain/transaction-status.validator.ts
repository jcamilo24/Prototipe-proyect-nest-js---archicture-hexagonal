import { TransactionStatus } from './transaction-status.enum';

export function validateFinalization(
  currentStatus: TransactionStatus,
  resultStatus: TransactionStatus,
  transactionId: string,
): void {

  if (currentStatus !== TransactionStatus.CREATED) {
    throw new Error(
      `Transaction ${transactionId} cannot be finalized: current status is ${currentStatus}, expected CREATED`,
    );
  }

  const allowedFinalStatuses = [
    TransactionStatus.CONFIRMED,
    TransactionStatus.FAILED,
    TransactionStatus.REVERSED,
    TransactionStatus.SUCCESS,
  ];

  if (!allowedFinalStatuses.includes(resultStatus)) {
    throw new Error(
      `Invalid final status for transaction ${transactionId}: ${resultStatus}. Expected CONFIRMED, FAILED, REVERSED or SUCCESS`,
    );
  }
}