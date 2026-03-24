import { CreateTransferUseCase } from '../../../src/transaction/application/use-cases/create-transfer.use-case';
import { Transaction } from '../../../src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from '../../../src/transaction/domain/transaction-status.enum';
import type { TransactionRepository } from '../../../src/transaction/domain/providers/transaction.repository';
import type { ExternalTransferService } from '../../../src/transaction/domain/providers/external-transfer.service';
import type { MetricsServicePort } from '../../../src/metrics/domain/providers/metrics.service.provider';

describe('CreateTransferUseCase', () => {
  let useCase: CreateTransferUseCase;
  let transactionRepository: { save: jest.Mock };
  let externalTransferService: { sendTransfer: jest.Mock };
  let metricsService: { increment: jest.Mock };

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

  const mockExternalResponse = {
    externalId: 'ext-123',
    status: TransactionStatus.CONFIRMED,
    traceId: 'trace-456',
    qrCodeId: 'qr-789',
    eventDate: '2025-02-27T12:00:00Z',
  };

  beforeEach(() => {
    transactionRepository = { save: jest.fn().mockResolvedValue(undefined) };
    externalTransferService = {
      sendTransfer: jest.fn().mockResolvedValue(mockExternalResponse),
    };
    metricsService = {
      increment: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateTransferUseCase(
      transactionRepository as unknown as TransactionRepository,
      externalTransferService as unknown as ExternalTransferService,
      metricsService as unknown as MetricsServicePort,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call external transfer service and then save transaction', async () => {
    const transactionForTest = new Transaction(
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
    const result = await useCase.execute(transactionForTest);

    expect(externalTransferService.sendTransfer).toHaveBeenCalledTimes(1);
    expect(externalTransferService.sendTransfer).toHaveBeenCalledWith(
      transactionForTest,
    );
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-001',
        status: TransactionStatus.CONFIRMED,
      }),
    );
    expect(result.transaction.status).toBe(TransactionStatus.CONFIRMED);
    expect(result.externalResponse).toEqual(mockExternalResponse);
  });

  it('should return transaction with updated status from external response', async () => {
    externalTransferService.sendTransfer.mockResolvedValue({
      ...mockExternalResponse,
      status: TransactionStatus.CONFIRMED,
    });

    const transactionForTest = new Transaction(
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
    const result = await useCase.execute(transactionForTest);

    expect(result.transaction.status).toBe(TransactionStatus.CONFIRMED);
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: TransactionStatus.CONFIRMED }),
    );
  });
});
