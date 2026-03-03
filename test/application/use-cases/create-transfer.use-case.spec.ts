import { Test, TestingModule } from '@nestjs/testing';
import { CreateTransferUseCase } from '../../../src/transaction/application/use-cases/create-transfer.use-case';
import { Transaction } from '../../../src/transaction/domain/entity/transaction.entity';

describe('CreateTransferUseCase', () => {
  let useCase: CreateTransferUseCase;
  let transactionRepository: { save: jest.Mock };
  let externalTransferService: { sendTransfer: jest.Mock };

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

  const mockExternalResponse = {
    externalId: 'ext-123',
    status: 'SUCCESS',
    traceId: 'trace-456',
    qrCodeId: 'qr-789',
    eventDate: '2025-02-27T12:00:00Z',
  };

  beforeEach(async () => {
    transactionRepository = { save: jest.fn().mockResolvedValue(undefined) };
    externalTransferService = {
      sendTransfer: jest.fn().mockResolvedValue(mockExternalResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransferUseCase,
        { provide: 'TransactionRepository', useValue: transactionRepository },
        { provide: 'ExternalTransferService', useValue: externalTransferService },
      ],
    }).compile();

    useCase = module.get<CreateTransferUseCase>(CreateTransferUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call external transfer service and then save transaction', async () => {
    const result = await useCase.execute(mockTransaction);

    expect(externalTransferService.sendTransfer).toHaveBeenCalledTimes(1);
    expect(externalTransferService.sendTransfer).toHaveBeenCalledWith(
      mockTransaction,
    );
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-001',
        status: 'SUCCESS',
      }),
    );
    expect(result.transaction.status).toBe('SUCCESS');
    expect(result.externalResponse).toEqual(mockExternalResponse);
  });

  it('should return transaction with updated status from external response', async () => {
    externalTransferService.sendTransfer.mockResolvedValue({
      ...mockExternalResponse,
      status: 'COMPLETED',
    });

    const result = await useCase.execute(mockTransaction);

    expect(result.transaction.status).toBe('COMPLETED');
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });
});
