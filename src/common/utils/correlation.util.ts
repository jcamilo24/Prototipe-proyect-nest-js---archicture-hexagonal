import { AsyncLocalStorage } from 'node:async_hooks';

type CorrelationStore = {
  correlationId: string;
  idempotencyKey?: string;
};

const asyncLocalStorage = new AsyncLocalStorage<CorrelationStore>();

export function runWithCorrelationId<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run({ correlationId: id, idempotencyKey: undefined }, fn);
}

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

export function setCorrelationId(id: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.correlationId = id;
  }
}

export function getIdempotencyKey(): string | undefined {
  return asyncLocalStorage.getStore()?.idempotencyKey;
}

export function setIdempotencyKey(idempotencyKey: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.idempotencyKey = idempotencyKey;
  }
}
