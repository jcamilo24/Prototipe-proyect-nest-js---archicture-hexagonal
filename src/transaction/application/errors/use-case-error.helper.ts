import { HttpException, InternalServerErrorException } from '@nestjs/common';

export function throwUseCaseError(err: unknown, context: string): never {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));
  throw new InternalServerErrorException(`${context}: failed`, {
    cause,
    description: cause.message,
  });
}
