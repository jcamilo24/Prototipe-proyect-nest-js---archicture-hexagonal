import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TransactionController } from '../src/transaction/infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from '../src/transaction/application/use-cases/create-transfer.use-case';

describe('TransactionController (e2e)', () => {
  let app: INestApplication;

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        CreateTransferUseCase,
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

  it('POST /transactions/transfer - returns 200 and response body with id, status, end_to_end_id, properties', () => {
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

    return request(app.getHttpServer())
      .post('/transactions/transfer')
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: 'tx-e2e-001',
          status: 'SUCCESS',
          end_to_end_id: 'e2e-end-to-end-id',
          properties: {
            trace_id: 'e2e-trace-id',
            event_date: '2025-02-27T12:00:00Z',
          },
        });
        expect(res.body.properties).toHaveProperty('trace_id');
      })
      .then(() => {
        expect(mockExternalTransferService.sendTransfer).toHaveBeenCalledTimes(1);
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

    return request(app.getHttpServer())
      .post('/transactions/transfer')
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
});
