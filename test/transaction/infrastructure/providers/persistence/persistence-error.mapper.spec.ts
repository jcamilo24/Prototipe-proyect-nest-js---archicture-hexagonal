import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { throwPersistenceError } from 'src/transaction/infrastructure/providers/persistence/persistence-error.mapper';

describe('throwPersistenceError', () => {
  it('re-throws HttpException', () => {
    const ex = new ConflictException('dup');
    expect(() => throwPersistenceError(ex, 'ctx')).toThrow(ex);
  });

  it('maps Mongo duplicate key (11000) to ConflictException', () => {
    expect(() =>
      throwPersistenceError({ code: 11000 }, '(save)'),
    ).toThrow(ConflictException);
  });

  it('maps connection-like messages to ServiceUnavailableException', () => {
    expect(() =>
      throwPersistenceError(new Error('connection timed out'), '(find)'),
    ).toThrow(ServiceUnavailableException);
  });

  it('maps Mongoose ValidationError to UnprocessableEntityException', () => {
    const err = Object.assign(new Error('invalid'), { name: 'ValidationError' });
    expect(() => throwPersistenceError(err, '(save)')).toThrow(
      UnprocessableEntityException,
    );
  });

  it('wraps unknown errors in InternalServerErrorException', () => {
    expect(() =>
      throwPersistenceError(new Error('other'), '(save)'),
    ).toThrow(InternalServerErrorException);
  });
});
