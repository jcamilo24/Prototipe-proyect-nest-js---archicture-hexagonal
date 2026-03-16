import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { TransactionController } from '../../../src/transaction/infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from '../../../src/transaction/application/use-cases/create-transfer.use-case';
import type { CreateTransferResponse } from '../../../src/transaction/infrastructure/entrypoints/model/create-transfer.response';
import type { IdempotencyService } from '../../../src/transaction/domain/providers/idempotency.service';

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

  const mockTransactionRepository = {
    save: jest.fn().mockResolvedValue(undefined),
  };

  const mockExternalTransferService = {
    sendTransfer: jest.fn().mockResolvedValue({
      externalId: 'e2e-end-to-end-id',
      status: 'SUCCESS',
      traceId: 'e2e-trace-id',
      qrCodeId: 'e2e-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    }),
  };

  beforeAll(async () => {
    mockIdempotencyService = createMockIdempotencyService();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: CreateTransferUseCase,
          useFactory: (transactionRepository, externalTransferService) =>
            new CreateTransferUseCase(
              transactionRepository,
              externalTransferService,
            ),
          inject: ['TransactionRepository', 'ExternalTransferService'],
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
          provide: 'ExternalTransferService',
          useValue: mockExternalTransferService,
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
    mockExternalTransferService.sendTransfer.mockResolvedValue({
      externalId: 'e2e-end-to-end-id',
      status: 'SUCCESS',
      traceId: 'e2e-trace-id',
      qrCodeId: 'e2e-qr-code',
      eventDate: '2025-02-27T12:00:00Z',
    });
  });

  it('POST /transactions/transfer - returns 200 and response body with id, status, endToEndId, properties', () => {
    const body = {
      transaction: {
        id: 'tx-e2e-001',
        amount: 50000,
        currency: 'PESOS',
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
          status: 'SUCCESS',
          endToEndId: 'e2e-end-to-end-id',
          properties: {
            traceId: 'e2e-trace-id',
            eventDate: '2025-02-27T12:00:00Z',
          },
        });
        expect(responseBody.properties).toHaveProperty('traceId');
      })
      .then(() => {
        expect(mockExternalTransferService.sendTransfer).toHaveBeenCalledTimes(
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
        expect(mockExternalTransferService.sendTransfer).toHaveBeenCalledWith(
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
      status: 'SUCCESS',
      endToEndId: 'e2e-end-to-end-id',
    });
    expect(mockExternalTransferService.sendTransfer).toHaveBeenCalledTimes(1);
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
        currency: 'PESOS',
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
});
