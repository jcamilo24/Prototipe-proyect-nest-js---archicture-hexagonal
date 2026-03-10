import { HttpException, InternalServerErrorException } from '@nestjs/common';

/**
 * Re-throws HttpException; wraps other errors with context for logging.
 * Use-case layer only: adapters (e.g. HTTP client) map their errors before
 * the use case sees them; the use case only adds context or re-throws.
 */
export function throwUseCaseError(err: unknown, context: string): never {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));
  throw new InternalServerErrorException(`${context}: failed`, {
    cause,
    description: cause.message,
  });
}
