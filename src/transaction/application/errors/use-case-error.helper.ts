import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UnsupportedCurrencyException } from '../../domain/unsupported-currency.exception';

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

/** Errores de negocio conocidos (p. ej. moneda no soportada) → 400, mismo patrón que throwUseCaseError. */
export function throwUseCaseBadRequest(err: unknown): never {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));
  throw new BadRequestException(cause.message, {
    cause,
    description: cause.message,
  });
}

export function isUnsupportedCurrencyError(err: unknown): boolean {
  return err instanceof UnsupportedCurrencyException;
}
