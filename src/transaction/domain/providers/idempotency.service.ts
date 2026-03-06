export interface IdempotencyService {
  handle<T>(
    key: string,
    requestHash: string,
    execute: () => Promise<T>,
  ): Promise<T>;
}
