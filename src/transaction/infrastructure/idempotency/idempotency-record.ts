import { randomUUID } from 'crypto';

export interface IdempotencyRecord<T> {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response: T;
  status: string;
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
    status: 'COMPLETED',
    created_at: new Date().toISOString(),
  };
}
