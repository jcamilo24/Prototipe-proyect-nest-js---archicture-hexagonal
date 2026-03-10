import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionController } from '../../../../src/transaction/infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from '../../../../src/transaction/application/use-cases/create-transfer.use-case';
import { Transaction } from '../../../../src/transaction/domain/entity/transaction.entity';
import type { CreateTransferResponse } from '../../../../src/transaction/infrastructure/entrypoints/model/create-transfer.response';

describe('TransactionController', () => {
  let controller: TransactionController;
  let createTransferUseCase: { execute: jest.Mock };
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
      'SUCCESS',
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
      'transfer-001',
      validRequestBody,
    );

    expect(createTransferUseCase.execute).toHaveBeenCalledTimes(1);
    expect(idempotencyService.handle).toHaveBeenCalledTimes(1);
    const firstCallArgs = createTransferUseCase.execute.mock
      .calls[0] as unknown as [Transaction];
    const passedTransaction = firstCallArgs[0];
    expect(passedTransaction).toBeInstanceOf(Transaction);
    expect(passedTransaction.id).toBe('tx-002');
    expect(passedTransaction.amount).toBe(111000);
    expect(passedTransaction.receiverDocument).toBe('3006985758');
    expect(passedTransaction.status).toBe('PENDING');

    expect(response).toEqual({
      id: 'tx-002',
      status: 'SUCCESS',
      endToEndId: 'e2e-123',
      qrCodeId: 'qr-xyz',
      properties: {
        eventDate: '2025-02-27T12:00:00Z',
        traceId: 'trace-abc',
      },
    });
  });

  it('should fail when idempotency key is missing', async () => {
    await expect(
      controller.create(undefined as never, validRequestBody),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
