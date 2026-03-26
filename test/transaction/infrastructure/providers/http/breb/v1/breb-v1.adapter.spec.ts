import { Test, TestingModule } from '@nestjs/testing';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { BREB_HTTP2_CLIENT_V1 } from 'src/transaction/infrastructure/providers/http/breb/client/breb-http2.client';
import { BrebV1Adapter } from 'src/transaction/infrastructure/providers/http/breb/v1/breb-v1.adapter';

describe('BrebV1Adapter', () => {
  let adapter: BrebV1Adapter;
  let brebClient: { postJson: jest.Mock; getJson: jest.Mock };
  let metricsService: {
    increment: jest.Mock;
    getMetrics: jest.Mock;
  };

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
    TransactionStatus.CREATED,
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
    brebClient = {
      postJson: jest.fn().mockResolvedValue(validBrebData),
      getJson: jest.fn(),
    };
    metricsService = {
      increment: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockResolvedValue({
        transfer_created: 0,
        transfer_failed: 0,
        breb_calls: 0,
        breb_errors: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrebV1Adapter,
        { provide: BREB_HTTP2_CLIENT_V1, useValue: brebClient },
        {
          provide: 'MetricsService',
          useValue: metricsService satisfies MetricsServicePort,
        },
      ],
    }).compile();

    adapter = module.get<BrebV1Adapter>(BrebV1Adapter);
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
      status: TransactionStatus.CONFIRMED,
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

  it('should return raw payload from getTransferById', async () => {
    const payload = { id: 'tx-1', status: 'CONFIRMED' };
    brebClient.getJson.mockResolvedValue(payload);

    const result = await adapter.getTransferById('tx-1');

    expect(brebClient.getJson).toHaveBeenCalledWith('tx-1');
    expect(result).toEqual(payload);
    expect(metricsService.increment).toHaveBeenCalledWith('breb_calls');
  });

  it('should increment breb_errors when getTransferById fails', async () => {
    brebClient.getJson.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.getTransferById('tx-1')).rejects.toThrow();
    expect(metricsService.increment).toHaveBeenCalledWith('breb_errors');
  });
});
