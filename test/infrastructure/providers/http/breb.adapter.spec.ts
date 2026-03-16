import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrebAdapter } from '../../../../src/transaction/infrastructure/providers/http/breb.service';
import { BREB_HTTP2_CLIENT } from '../../../../src/transaction/infrastructure/providers/http/breb-http2.client';
import { Transaction } from '../../../../src/transaction/domain/entity/transaction.entity';

describe('BrebAdapter', () => {
  let adapter: BrebAdapter;
  let brebClient: { postJson: jest.Mock };

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

  const validBrebData = {
    end_to_end_id: 'e2e-123',
    qr_code_id: 'qr-456',
    status: 'SUCCESS',
    properties: {
      event_date: '2025-02-27T12:00:00Z',
      trace_id: 'trace-789',
    },
  };

  beforeEach(async () => {
    brebClient = { postJson: jest.fn().mockResolvedValue(validBrebData) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrebAdapter,
        { provide: BREB_HTTP2_CLIENT, useValue: brebClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              ({
                BREB_CIRCUIT_TIMEOUT_MS: '15000',
                BREB_CIRCUIT_ERROR_THRESHOLD_PERCENT: '65',
                BREB_CIRCUIT_RESET_TIMEOUT_MS: '30000',
                BREB_CIRCUIT_VOLUME_THRESHOLD: '10',
              }[key]),
            ),
          },
        },
      ],
    }).compile();

    adapter = module.get<BrebAdapter>(BrebAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should send transfer with transaction in English format and return mapped result', async () => {
    const result = await adapter.sendTransfer(mockTransaction);

    expect(brebClient.postJson).toHaveBeenCalledTimes(1);
    const [body] = brebClient.postJson.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(body).toEqual({
      transaction: {
        id: 'tx-001',
        amount: 100000,
        currency: 'PESOS',
        description: 'Recarga',
        receiver: {
          document: '123456',
          documentType: 'CC',
          name: 'Juan Pérez',
          account: '1234567890',
          accountType: 'Ahorros',
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
    brebClient.postJson.mockResolvedValue({ status: 'SUCCESS' });

    await expect(adapter.sendTransfer(mockTransaction)).rejects.toThrow();
  });

  it('should throw when HTTP request fails', async () => {
    brebClient.postJson.mockRejectedValue(new Error('Network error'));

    await expect(adapter.sendTransfer(mockTransaction)).rejects.toThrow();
  });
});
