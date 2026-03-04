import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { BrebAdapter } from '../../../../src/transaction/infrastructure/providers/http/breb.adapter';
import { Transaction } from '../../../../src/transaction/domain/entity/transaction.entity';

describe('BrebAdapter', () => {
  let adapter: BrebAdapter;
  let httpService: { post: jest.Mock };

  const mockTransaction = new Transaction(
    'tx-001',
    100000,
    'PESOS',
    'Recarga',
    '123456',
    'CC',
    'Juan Pérez',
    '1234567890',
    'Ahorros',
    'PENDING',
  );

  const validBrebResponse = {
    data: {
      end_to_end_id: 'e2e-123',
      qr_code_id: 'qr-456',
      status: 'SUCCESS',
      properties: {
        event_date: '2025-02-27T12:00:00Z',
        trace_id: 'trace-789',
      },
    },
    status: 200,
  };

  beforeEach(async () => {
    httpService = { post: jest.fn().mockReturnValue(of(validBrebResponse)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrebAdapter,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    adapter = module.get<BrebAdapter>(BrebAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should send transfer with transaction in puntored format and return mapped result', async () => {
    const result = await adapter.sendTransfer(mockTransaction);

    expect(httpService.post).toHaveBeenCalledTimes(1);
    const [url, body] = httpService.post.mock.calls[0];
    expect(url).toBeDefined();
    expect(body).toEqual({
      transaction: {
        id: 'tx-001',
        amount: 100000,
        moneda: 'PESOS',
        descripcion: 'Recarga',
        receptor: {
          documento: '123456',
          tipoDocumento: 'CC',
          nombre: 'Juan Pérez',
          cuenta: '1234567890',
          tipoCuenta: 'Ahorros',
        },
      },
    });

    expect(result).toEqual({
      externalId: 'e2e-123',
      status: 'SUCCESS',
      traceId: 'trace-789',
      qrCodeId: 'qr-456',
      eventDate: '2025-02-27T12:00:00Z',
    });
  });

  it('should throw when external service returns invalid structure', async () => {
    httpService.post.mockReturnValue(
      of({ data: { status: 'SUCCESS' }, status: 200 }),
    );

    await expect(adapter.sendTransfer(mockTransaction)).rejects.toThrow();
  });

  it('should throw when HTTP request fails', async () => {
    httpService.post.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    await expect(adapter.sendTransfer(mockTransaction)).rejects.toThrow();
  });
});
