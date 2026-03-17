import { randomUUID } from 'crypto';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

export type IdempotencyRecord<T> = {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response: T;
  status: TransactionStatus;
  created_at: string;
}

export function createIdempotencyRecord<T>(
  key: string,
  requestHash: string,
  response: T,
): IdempotencyRecord<T> {
  return {
    id: randomUUID(),
    idempotency_key: key,
    request_hash: requestHash,
    response,
    status: TransactionStatus.CONFIRMED,
    created_at: new Date().toISOString(),
  };
}
