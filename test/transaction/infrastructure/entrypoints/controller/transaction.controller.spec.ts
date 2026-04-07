import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyReply } from 'fastify';
import { CreateTransferUseCase } from 'src/transaction/application/use-cases/create-transfer.use-case';
import { GetTransferByIdUseCase } from 'src/transaction/application/use-cases/get-transfer-by-id.use-case';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { TransactionController } from 'src/transaction/infrastructure/entrypoints/controller/transaction.controller';
import type { CreateTransferResponse } from 'src/transaction/infrastructure/entrypoints/model/create-transfer.response';

describe('TransactionController', () => {
  let controller: TransactionController;
  let createTransferUseCase: { execute: jest.Mock };
  let getTransferByIdUseCase: { execute: jest.Mock };
  let idempotencyService: { handle: jest.Mock };

  const validRequestBody = {
    transaction: {
      id: 'tx-002',
      amount: 111000,
      currency: 'USD',
      description: 'Recarga celular',
      receiver: {
        document: '3006985758',
        documentType: 'CC',
        name: 'MI EMPRESA S.A.S',
        account: '323232',
        accountType: 'Ahorros',
      },
    },
  };

  const mockUseCaseResult = {
    transaction: new Transaction(
      'tx-002',
      111000,
      'USD',
      'Recarga celular',
      '3006985758',
      'CC',
      'MI EMPRESA S.A.S',
      '323232',
      'Ahorros',
      TransactionStatus.CONFIRMED,
    ),
    externalResponse: {
      externalId: 'e2e-123',
      status: 'SUCCESS',
      traceId: 'trace-abc',
      qrCodeId: 'qr-xyz',
      eventDate: '2025-02-27T12:00:00Z',
    },
  };

  beforeEach(async () => {
    createTransferUseCase = {
      execute: jest.fn().mockResolvedValue(mockUseCaseResult),
    };
    getTransferByIdUseCase = {
      execute: jest.fn(),
    };
    idempotencyService = {
      handle: jest
        .fn()
        .mockImplementation(
          (
            _key: string,
            _hash: string,
            execute: () => Promise<CreateTransferResponse>,
          ) => execute(),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: CreateTransferUseCase, useValue: createTransferUseCase },
        { provide: GetTransferByIdUseCase, useValue: getTransferByIdUseCase },
        { provide: 'IdempotencyService', useValue: idempotencyService },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should map request to entity and return response with id, status and external data', async () => {
    const response: CreateTransferResponse = await controller.create(
      'v1',
      'transfer-001',
      validRequestBody,
    );

    expect(createTransferUseCase.execute).toHaveBeenCalledTimes(1);
    expect(idempotencyService.handle).toHaveBeenCalledTimes(1);
    const firstCallArgs = createTransferUseCase.execute.mock
      .calls[0] as unknown as [Transaction, string];
    const passedTransaction = firstCallArgs[0];
    expect(firstCallArgs[1]).toBe('v1');
    expect(passedTransaction).toBeInstanceOf(Transaction);
    expect(passedTransaction.id).toBe('tx-002');
    expect(passedTransaction.amount).toBe(111000);
    expect(passedTransaction.receiverDocument).toBe('3006985758');
    expect(passedTransaction.status).toBe(TransactionStatus.CREATED);

    expect(response).toEqual({
      id: 'tx-002',
      status: TransactionStatus.CONFIRMED,
      endToEndId: 'e2e-123',
      qrCodeId: 'qr-xyz',
      properties: {
        eventDate: '2025-02-27T12:00:00Z',
        traceId: 'trace-abc',
      },
      fee: 0,
    });
  });

  it('should fail when idempotency key is missing', async () => {
    await expect(
      controller.create(undefined, undefined as never, validRequestBody),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('omitted brebVersion query passes empty string (default v1 in use case)', async () => {
    const response: CreateTransferResponse = await controller.create(
      undefined,
      'transfer-default',
      validRequestBody,
    );

    expect(createTransferUseCase.execute).toHaveBeenCalledTimes(1);
    const args = createTransferUseCase.execute.mock.calls[0] as unknown as [
      Transaction,
      string,
    ];
    expect(args[1]).toBe('');
    expect(response.id).toBe('tx-002');
  });

  it('GET getTransferById - returns 200 and sends response when transfer exists', async () => {
    const mockTransaction = new Transaction(
      'tx-get-001',
      50000,
      'USD',
      'Test',
      '123',
      'CC',
      'Test User',
      'acc-1',
      'Ahorros',
      TransactionStatus.CONFIRMED,
    );
    getTransferByIdUseCase.execute.mockResolvedValue(mockTransaction);

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as FastifyReply;

    await controller.getTransferById('tx-get-001', res);

    expect(getTransferByIdUseCase.execute).toHaveBeenCalledWith('tx-get-001');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-get-001',
        status: TransactionStatus.CONFIRMED,
        amount: 50000,
      }),
    );
  });

  it('GET getTransferById - returns 404 when transfer not found', async () => {
    getTransferByIdUseCase.execute.mockResolvedValue(null);

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as FastifyReply;

    await controller.getTransferById('non-existent', res);

    expect(getTransferByIdUseCase.execute).toHaveBeenCalledWith('non-existent');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      message: 'Transfer with id non-existent not found',
    });
  });
});
