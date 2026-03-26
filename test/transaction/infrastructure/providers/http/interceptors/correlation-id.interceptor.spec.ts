import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { defer, of } from 'rxjs';
import { CorrelationIdInterceptor } from 'src/transaction/infrastructure/providers/http/interceptors/correlation-id.interceptor';
import { getCorrelationId } from 'src/common/utils/correlation.util';

describe('CorrelationIdInterceptor', () => {
  const createContext = (
    headers: Record<string, string | undefined>,
  ): ExecutionContext => {
    const res = { header: jest.fn() };
    const req = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  it('generates UUID when header missing and sets response header', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const res = { header: jest.fn() };
    const req = { headers: {} };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    const next = { handle: () => of({ done: true }) };
    await firstValueFrom(interceptor.intercept(context, next));

    expect(res.header).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );
  });

  it('reuses x-correlation-id from request when present', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const res = { header: jest.fn() };
    const req = { headers: { 'x-correlation-id': '  my-id  ' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    const next = { handle: () => of({ ok: 1 }) };
    await firstValueFrom(interceptor.intercept(context, next));

    expect(res.header).toHaveBeenCalledWith('x-correlation-id', 'my-id');
  });

  it('runs handler inside correlation context', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const context = createContext({ 'x-correlation-id': 'ctx-1' });
    let seen: string | undefined;
    const next = {
      handle: () =>
        defer(() => {
          seen = getCorrelationId();
          return of(true);
        }),
    };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(seen).toBe('ctx-1');
  });
});
