import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { from, lastValueFrom } from 'rxjs';
import { runWithCorrelationId } from '../../../../../common/utils/correlation.util';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const raw = request.headers?.['x-correlation-id'] ?? request.headers?.['X-Correlation-Id'];
    const id = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : randomUUID();

    response.header('x-correlation-id', id);

    return from(
      runWithCorrelationId(id, () => lastValueFrom(next.handle())),
    );
  }
}
