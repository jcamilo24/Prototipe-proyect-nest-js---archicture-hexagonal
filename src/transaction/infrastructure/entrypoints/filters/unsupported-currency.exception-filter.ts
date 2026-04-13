import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { UnsupportedCurrencyException } from 'src/transaction/domain/unsupported-currency.exception';

/**
 * Mapea errores de dominio (moneda inválida) a respuesta HTTP 400.
 * Mantiene la capa de aplicación libre de detalles HTTP / Nest.
 */
@Catch(UnsupportedCurrencyException)
export class UnsupportedCurrencyExceptionFilter implements ExceptionFilter {
  catch(exception: UnsupportedCurrencyException, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = HttpStatus.BAD_REQUEST;
    void reply.status(status).send({
      statusCode: status,
      message: exception.message,
      error: 'Bad Request',
    });
  }
}
