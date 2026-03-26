import * as http2 from 'node:http2';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import {
  runWithCorrelationId,
  setIdempotencyKey,
} from '../../src/common/utils/correlation.util';
import { BrebHttp2ClientImpl } from '../../src/transaction/infrastructure/providers/http/breb/client/breb-http2.client';
import { BrebV1Adapter } from '../../src/transaction/infrastructure/providers/http/breb/v1/breb-v1.adapter';
import { CreateTransferUseCase } from '../../src/transaction/application/use-cases/create-transfer.use-case';
import { Transaction } from '../../src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from '../../src/transaction/domain/transaction-status.enum';
import type { TransactionRepository } from '../../src/transaction/domain/providers/transaction.repository';
import type { MetricsServicePort } from '../../src/metrics/domain/providers/metrics.service.provider';

function brebCircuitConfigMock(): ConfigService {
  return {
    get: (key: string) => {
      const map: Record<string, string> = {
        BREB_CIRCUIT_TIMEOUT_MS: '30000',
        BREB_CIRCUIT_ERROR_THRESHOLD_PERCENT: '50',
        BREB_CIRCUIT_RESET_TIMEOUT_MS: '10000',
        BREB_CIRCUIT_VOLUME_THRESHOLD: '100',
      };
      return map[key];
    },
  } as ConfigService;
}

function startMockBrebHttp2Server(): Promise<{
  server: http2.Http2Server;
  baseUrl: string;
  state: { idempotencyKey?: string };
}> {
  return new Promise((resolve, reject) => {
    const server = http2.createServer();
    const state: { idempotencyKey?: string } = {};
    server.on('stream', (stream, headers) => {
      const method = headers[':method'];
      const path = headers[':path'] ?? '';
      const idem = headers['idempotency-key'];
      state.idempotencyKey = typeof idem === 'string' ? idem : undefined;
      if (method !== 'POST' || path !== '/transfer') {
        stream.respond({ ':status': 404 });
        stream.end();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        stream.respond({
          'content-type': 'application/json',
          ':status': 200,
        });
        stream.end(
          JSON.stringify({
            end_to_end_id: 'e2e-integration',
            qr_code_id: 'qr-integration',
            status: 'SUCCESS',
            properties: {
              event_date: '2025-03-25T12:00:00.000Z',
              trace_id: 'trace-integration',
            },
          }),
        );
      });
      stream.on('error', () => stream.destroy());
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${addr.port}/transfer`;
      resolve({ server, baseUrl, state });
    });
  });
}

describe('Integration: transfer → mock BREB (HTTP/2)', () => {
  let server: http2.Http2Server;
  let client: BrebHttp2ClientImpl;

  afterEach(async () => {
    if (client) {
      await client.onModuleDestroy();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('executes CreateTransferUseCase against a real HTTP/2 BREB-shaped server', async () => {
    const { server: s, baseUrl, state } = await startMockBrebHttp2Server();
    server = s;

    const config = brebCircuitConfigMock();
    client = new BrebHttp2ClientImpl(config, baseUrl);

    const metrics: MetricsServicePort = {
      increment: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn(),
    };
    const adapter = new BrebV1Adapter(client, metrics);

    const saved: Transaction[] = [];
    const repository: TransactionRepository = {
      save: jest.fn(async (tx: Transaction) => {
        saved.push(tx);
      }),
      findById: jest.fn(),
    };

    const useCase = new CreateTransferUseCase(
      repository,
      adapter,
      metrics,
    );

    const transaction = new Transaction(
      'tx-int-001',
      5000,
      'USD',
      'Integration',
      '3006985758',
      'CC',
      'Test Co',
      '323232',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    const result = await runWithCorrelationId('corr-int-1', async () => {
      setIdempotencyKey('idem-int-1');
      return useCase.execute(transaction);
    });

    expect(result.transaction.status).toBe(TransactionStatus.CONFIRMED);
    expect(result.externalResponse.externalId).toBe('e2e-integration');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(saved[0]?.status).toBe(TransactionStatus.CONFIRMED);
    expect(state.idempotencyKey).toBe('idem-int-1');
  });
});
