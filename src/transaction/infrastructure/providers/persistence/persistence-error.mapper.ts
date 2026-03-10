import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Maps persistence errors (MongoDB/Mongoose) to Nest HTTP exceptions.
 * Preserves context and cause for logging.
 */
export function throwPersistenceError(err: unknown, context: string): never {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));

  const mongoCode =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code: number }).code
      : undefined;
  if (mongoCode === 11000) {
    throw new ConflictException(`${context}: duplicate transaction id`, {
      cause,
      description: 'Duplicate transaction id',
    });
  }

  const msg = cause.message?.toLowerCase() ?? '';
  if (
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('enetunreach') ||
    msg.includes('timed out') ||
    msg.includes('server selection')
  ) {
    throw new ServiceUnavailableException(
      `${context}: could not connect to the database`,
      { cause, description: 'MongoDB connection failed' },
    );
  }

  if (
    err &&
    typeof err === 'object' &&
    'name' in err &&
    err.name === 'ValidationError'
  ) {
    throw new UnprocessableEntityException(`${context}: validation failed`, {
      cause,
      description: 'Mongoose validation failed',
    });
  }

  throw new InternalServerErrorException(`${context}: persistence error`, {
    cause,
    description: cause.message,
  });
}
