import { Test, TestingModule } from '@nestjs/testing';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { Currency } from 'src/transaction/domain/currency.enum';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { HTTP2_CLIENT_V2 } from 'src/transaction/infrastructure/providers/http/client/http2.client';
import { BrebV2Adapter } from 'src/transaction/infrastructure/providers/http/breb/v2/breb-v2.adapter';

describe('BrebV2Adapter', () => {
  let adapter: BrebV2Adapter;
  let brebClient: { postJson: jest.Mock; getJson: jest.Mock };
  let metricsService: {
    increment: jest.Mock;
    getMetrics: jest.Mock;
  };

  const mockTransaction = new Transaction(
    'tx-v2-001',
    100000,
    Currency.COP,
    'Recarga',
    '123456',
    'CC',
    'Juan Pérez',
    '1234567890',
    'Ahorros',
    TransactionStatus.CREATED,
  );

  const validBrebData = {
    end_to_end_id: 'e2e-v2',
    qr_code_id: 'qr-v2',
    status: 'SUCCESS',
    properties: {
      event_date: '2025-02-27T12:00:00Z',
      trace_id: 'trace-v2',
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
        BrebV2Adapter,
        { provide: HTTP2_CLIENT_V2, useValue: brebClient },
        {
          provide: 'MetricsService',
          useValue: metricsService satisfies MetricsServicePort,
        },
      ],
    }).compile();

    adapter = module.get<BrebV2Adapter>(BrebV2Adapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should send transfer and return mapped result (v2 client token)', async () => {
    const result = await adapter.sendTransfer(mockTransaction);

    expect(brebClient.postJson).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(TransactionStatus.CONFIRMED);
    expect(result.externalId).toBe('e2e-v2');
  });
});
