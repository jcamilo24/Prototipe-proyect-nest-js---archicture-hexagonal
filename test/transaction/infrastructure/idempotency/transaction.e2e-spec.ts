import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { CreateTransferUseCase } from 'src/transaction/application/use-cases/create-transfer.use-case';
import { GetTransferByIdUseCase } from 'src/transaction/application/use-cases/get-transfer-by-id.use-case';
import { Currency } from 'src/transaction/domain/currency.enum';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import type { IdempotencyService } from 'src/transaction/domain/providers/idempotency.service';
import type { TransactionRepository } from 'src/transaction/domain/providers/transaction.repository';
import { TransferFeeCalculator } from 'src/transaction/domain/transfer-fee.calculator';
import { TransactionController } from 'src/transaction/infrastructure/entrypoints/controller/transaction.controller';
import type { CreateTransferResponse } from 'src/transaction/infrastructure/entrypoints/model/create-transfer.response';

/** In-memory idempotency for e2e: same key + same hash → cached response; same key + different hash → 409. */
function createMockIdempotencyService(): IdempotencyService {
  const store = new Map<string, { requestHash: string; response: unknown }>();
  return {
    async handle<T>(
      key: string,
      requestHash: string,
      execute: () => Promise<T>,
    ): Promise<T> {
      const stored = store.get(key);
      if (stored) {
        if (stored.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency-Key reused with different payload',
          );
        }
        return stored.response as T;
      }
      const response = await execute();
      store.set(key, { requestHash, response });
      return response;
    },
  };
}

const IDEMPOTENCY_HEADER = 'idempotency-key';

describe('TransactionController (e2e)', () => {
  let app: INestApplication;
  let mockIdempotencyService: IdempotencyService;

  const mockTransactionRepository: {
    save: jest.Mock;
    findById: jest.Mock;
  } = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
  };

  const mockExternalTransferV1 = {
    sendTransfer: jest.fn().mockResolvedValue({
      externalId: 'e2e-end-to-end-id',
      status: TransactionStatus.CONFIRMED,
      traceId: 'e2e-trace-id',
      qrCodeId: 'e2e-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    }),
  };
  const mockExternalTransferV2 = {
    sendTransfer: jest.fn().mockResolvedValue({
      externalId: 'e2e-v2-end-to-end-id',
      status: TransactionStatus.CONFIRMED,
      traceId: 'e2e-v2-trace-id',
      qrCodeId: 'e2e-v2-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    }),
  };
  const mockMetricsService: MetricsServicePort = {
    increment: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn().mockResolvedValue({
      transfer_created: 0,
      transfer_failed: 0,
      breb_calls: 0,
      breb_errors: 0,
    }),
  };

  beforeAll(async () => {
    mockIdempotencyService = createMockIdempotencyService();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        TransferFeeCalculator,
        {
          provide: CreateTransferUseCase,
          useFactory: (
            transactionRepository: TransactionRepository,
            v1: typeof mockExternalTransferV1,
            v2: typeof mockExternalTransferV2,
            metricsService: MetricsServicePort,
            transferFeeCalculator: TransferFeeCalculator,
          ) =>
            new CreateTransferUseCase(
              transactionRepository,
              v1 as never,
              v2 as never,
              metricsService,
              transferFeeCalculator,
            ),
          inject: [
            'TransactionRepository',
            'ExternalTransferV1',
            'ExternalTransferV2',
            'MetricsService',
            TransferFeeCalculator,
          ],
        },
        {
          provide: GetTransferByIdUseCase,
          useFactory: (transactionRepository: TransactionRepository) =>
            new GetTransferByIdUseCase(transactionRepository),
          inject: ['TransactionRepository'],
        },
        {
          provide: 'IdempotencyService',
          useValue: mockIdempotencyService,
        },
        {
          provide: 'TransactionRepository',
          useValue: mockTransactionRepository,
        },
        {
          provide: 'ExternalTransferV1',
          useValue: mockExternalTransferV1,
        },
        {
          provide: 'ExternalTransferV2',
          useValue: mockExternalTransferV2,
        },
        {
          provide: 'MetricsService',
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExternalTransferV1.sendTransfer.mockResolvedValue({
      externalId: 'e2e-end-to-end-id',
      status: TransactionStatus.CONFIRMED,
      traceId: 'e2e-trace-id',
      qrCodeId: 'e2e-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    });
    mockExternalTransferV2.sendTransfer.mockResolvedValue({
      externalId: 'e2e-v2-end-to-end-id',
      status: TransactionStatus.CONFIRMED,
      traceId: 'e2e-v2-trace-id',
      qrCodeId: 'e2e-v2-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    });
    mockTransactionRepository.findById.mockResolvedValue(null);
  });

  it('POST /transactions/transfer - returns 201 and response body with id, status, endToEndId, properties (default v1)', () => {
    const body = {
      transaction: {
        id: 'tx-e2e-001',
        amount: 50000,
        currency: 'USD',
        description: 'Test e2e',
        receiver: {
          document: '12345678',
          documentType: 'CC',
          name: 'Usuario Test',
          account: '9876543210',
          accountType: 'Ahorros',
        },
      },
    };

    // Nest getHttpServer() type is not compatible with supertest App; cast is safe at runtime

    const server = app.getHttpServer() as unknown as Server;

    return request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, 'e2e-key-001')
      .send(body)
      .expect(201)
      .expect((res: { body: unknown }) => {
        const responseBody = res.body as CreateTransferResponse;
        expect(responseBody).toMatchObject({
          id: 'tx-e2e-001',
          status: TransactionStatus.CONFIRMED,
          endToEndId: 'e2e-end-to-end-id',
          fee: 1000,
          properties: {
            traceId: 'e2e-trace-id',
            eventDate: '2025-02-27T12:00:00Z',
          },
        });
        expect(responseBody.properties).toHaveProperty('traceId');
      })
      .then(() => {
        expect(mockExternalTransferV1.sendTransfer).toHaveBeenCalledTimes(
          1,
        );
        expect(mockTransactionRepository.save).toHaveBeenCalledTimes(1);
      });
  });

  it('POST /transactions/transfer - calls external service with transaction built from body', () => {
    const body = {
      transaction: {
        id: 'tx-e2e-002',
        amount: 100000,
        currency: 'USD',
        description: 'Transfer e2e',
        receiver: {
          document: '87654321',
          documentType: 'CC',
          name: 'Receptor E2E',
          account: '111111',
          accountType: 'Ahorros',
        },
      },
    };

    // Nest getHttpServer() type is not compatible with supertest App; cast is safe at runtime

    const server = app.getHttpServer() as unknown as Server;

    return request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, 'e2e-key-002')
      .send(body)
      .expect(201)
      .then(() => {
        expect(mockExternalTransferV1.sendTransfer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'tx-e2e-002',
            amount: 100000,
            currency: 'USD',
            description: 'Transfer e2e',
            receiverDocument: '87654321',
            receiverName: 'Receptor E2E',
            receiverAccount: '111111',
          }),
        );
      });
  });

  it('POST /transactions/transfer - same Idempotency-Key and same body twice returns same response and calls use case once', async () => {
    const body = {
      transaction: {
        id: 'tx-e2e-idem',
        amount: 25000,
        currency: 'USD',
        description: 'Idempotent transfer',
        receiver: {
          document: '11111111',
          documentType: 'CC',
          name: 'Receptor Idem',
          account: '222222',
          accountType: 'Ahorros',
        },
      },
    };
    const key = 'e2e-idempotency-same';

    const server = app.getHttpServer() as unknown as Server;

    const first = await request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, key)
      .send(body)
      .expect(201);

    const second = await request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, key)
      .send(body)
      .expect(201);

    expect(first.body).toEqual(second.body);
    expect(first.body).toMatchObject({
      id: 'tx-e2e-idem',
      status: TransactionStatus.CONFIRMED,
      endToEndId: 'e2e-end-to-end-id',
    });
    expect(mockExternalTransferV1.sendTransfer).toHaveBeenCalledTimes(1);
    expect(mockTransactionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('POST /transactions/transfer - same Idempotency-Key with different body returns 409', async () => {
    const key = 'e2e-idempotency-conflict';
    const body1 = {
      transaction: {
        id: 'tx-e2e-a',
        amount: 1000,
        currency: 'USD',
        description: 'First',
        receiver: {
          document: '111',
          documentType: 'CC',
          name: 'A',
          account: 'acc1',
          accountType: 'Ahorros',
        },
      },
    };
    const body2 = {
      transaction: {
        id: 'tx-e2e-b',
        amount: 2000,
        currency: 'USD',
        description: 'Second',
        receiver: {
          document: '222',
          documentType: 'CC',
          name: 'B',
          account: 'acc2',
          accountType: 'Corriente',
        },
      },
    };

    const server = app.getHttpServer() as unknown as Server;

    await request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, key)
      .send(body1)
      .expect(201);

    await request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, key)
      .send(body2)
      .expect(409);
  });

  it('POST /transactions/transfer?brebVersion=v2 - uses v2 external adapter', () => {
    const body = {
      transaction: {
        id: 'tx-e2e-v2',
        amount: 1,
        currency: 'USD',
        description: 'V2 query',
        receiver: {
          document: '1',
          documentType: 'CC',
          name: 'V2',
          account: '1',
          accountType: 'Ahorros',
        },
      },
    };

    const server = app.getHttpServer() as unknown as Server;

    return request(server)
      .post('/transactions/transfer')
      .query({ brebVersion: 'v2' })
      .set(IDEMPOTENCY_HEADER, 'e2e-key-v2')
      .send(body)
      .expect(201)
      .then(() => {
        expect(mockExternalTransferV2.sendTransfer).toHaveBeenCalledTimes(1);
        expect(mockExternalTransferV1.sendTransfer).not.toHaveBeenCalled();
      });
  });

  it('POST /transactions/transfer?brebVersion=v99 - unknown version falls back to v1 adapter', () => {
    const server = app.getHttpServer() as unknown as Server;

    return request(server)
      .post('/transactions/transfer')
      .query({ brebVersion: 'v99' })
      .set(IDEMPOTENCY_HEADER, 'e2e-key-bad-version')
      .send({
        transaction: {
          id: 'tx-bad-ver',
          amount: 1,
          currency: 'USD',
          description: 'x',
          receiver: {
            document: '1',
            documentType: 'CC',
            name: 'X',
            account: '1',
            accountType: 'Ahorros',
          },
        },
      })
      .expect(201)
      .then(() => {
        expect(mockExternalTransferV1.sendTransfer).toHaveBeenCalledTimes(1);
        expect(mockExternalTransferV2.sendTransfer).not.toHaveBeenCalled();
      });
  });

  it('GET /transactions/:id - returns 200 and body when transfer exists', async () => {
    const storedTransaction = new Transaction(
      'tx-e2e-get',
      75000,
      Currency.USD,
      'E2E GET test',
      '111',
      'CC',
      'GET User',
      'acc-get',
      'Ahorros',
      TransactionStatus.CONFIRMED,
    );
    mockTransactionRepository.findById.mockResolvedValueOnce(storedTransaction);

    const server = app.getHttpServer() as unknown as Server;

    const res = await request(server)
      .get('/transactions/tx-e2e-get')
      .expect(200);

    expect(res.body).toMatchObject({
      id: 'tx-e2e-get',
      status: TransactionStatus.CONFIRMED,
      amount: 75000,
      currency: 'USD',
      description: 'E2E GET test',
    });
    expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-e2e-get');
  });

  it('GET /transactions/:id - returns 404 when transfer not found', async () => {
    mockTransactionRepository.findById.mockResolvedValueOnce(null);

    const server = app.getHttpServer() as unknown as Server;

    const res = await request(server)
      .get('/transactions/non-existent-id')
      .expect(404);

    expect(res.body).toMatchObject({
      message: 'Transfer with id non-existent-id not found',
    });
    expect(mockTransactionRepository.findById).toHaveBeenCalledWith('non-existent-id');
  });

  it('POST /transactions/transfer - missing Idempotency-Key returns 400', async () => {
    const server = app.getHttpServer() as unknown as Server;

    await request(server)
      .post('/transactions/transfer')
      .send({
        transaction: {
          id: 'tx-e2e-no-key',
          amount: 100,
          currency: 'USD',
          description: 'No key',
          receiver: {
            document: '999',
            documentType: 'CC',
            name: 'X',
            account: 'acc',
            accountType: 'Ahorros',
          },
        },
      })
      .expect(400);
  });

  it('POST /transactions/transfer - unsupported currency returns 400 before BREB', async () => {
    const server = app.getHttpServer() as unknown as Server;

    await request(server)
      .post('/transactions/transfer')
      .set(IDEMPOTENCY_HEADER, 'e2e-key-bad-currency')
      .send({
        transaction: {
          id: 'tx-e2e-bad-curr',
          amount: 100,
          currency: 'EUR',
          description: 'bad currency',
          receiver: {
            document: '1',
            documentType: 'CC',
            name: 'X',
            account: 'acc',
            accountType: 'Ahorros',
          },
        },
      })
      .expect(400);

    expect(mockExternalTransferV1.sendTransfer).not.toHaveBeenCalled();
    expect(mockExternalTransferV2.sendTransfer).not.toHaveBeenCalled();
    expect(mockTransactionRepository.save).not.toHaveBeenCalled();
  });
});
