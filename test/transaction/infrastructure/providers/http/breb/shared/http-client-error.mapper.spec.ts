import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { throwHttpClientError } from 'src/transaction/infrastructure/providers/http/breb/shared/http-client-error.mapper';

describe('throwHttpClientError', () => {
  it('re-throws HttpException', () => {
    const ex = new BadGatewayException('bad');
    expect(() => throwHttpClientError(ex)).toThrow(ex);
  });

  it('maps axios-like network code to ServiceUnavailable', () => {
    expect(() =>
      throwHttpClientError({
        isAxiosError: true,
        code: 'ECONNREFUSED',
        message: 'connect',
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('maps axios 5xx response to BadGateway', () => {
    expect(() =>
      throwHttpClientError({
        response: { status: 503 },
        message: 'err',
      }),
    ).toThrow(BadGatewayException);
  });

  it('maps axios 4xx response to BadGateway', () => {
    expect(() =>
      throwHttpClientError({
        response: { status: 404 },
        message: 'err',
      }),
    ).toThrow(BadGatewayException);
  });

  it('maps Node errno to ServiceUnavailable', () => {
    const err = new Error('x') as NodeJS.ErrnoException;
    err.code = 'ECONNRESET';
    expect(() => throwHttpClientError(err)).toThrow(ServiceUnavailableException);
  });

  it('maps invalid response message to InternalServerErrorException', () => {
    expect(() =>
      throwHttpClientError(new Error('invalid response structure')),
    ).toThrow(InternalServerErrorException);
  });

  it('wraps unknown errors in InternalServerErrorException', () => {
    expect(() => throwHttpClientError(new Error('weird'))).toThrow(
      InternalServerErrorException,
    );
  });
});
