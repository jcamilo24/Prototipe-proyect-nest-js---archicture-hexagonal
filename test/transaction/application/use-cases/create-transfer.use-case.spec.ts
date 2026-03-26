import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { CreateTransferUseCase } from 'src/transaction/application/use-cases/create-transfer.use-case';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import type { ExternalTransferService } from 'src/transaction/domain/providers/external-transfer.service';
import type { TransactionRepository } from 'src/transaction/domain/providers/transaction.repository';

describe('CreateTransferUseCase', () => {
  let useCase: CreateTransferUseCase;
  let transactionRepository: { save: jest.Mock };
  let externalTransferService: { sendTransfer: jest.Mock };
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
      getMetrics: jest.fn().mockResolvedValue({
        transfer_created: 0,
        transfer_failed: 0,
        breb_calls: 0,
        breb_errors: 0,
      }),
    };
    useCase = new CreateTransferUseCase(
      transactionRepository as unknown as TransactionRepository,
      externalTransferService as unknown as ExternalTransferService,
      metricsService satisfies MetricsServicePort,
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

  it('should rethrow HttpException from external service and increment transfer_failed', async () => {
    const ex = new BadGatewayException('upstream');
    externalTransferService.sendTransfer.mockRejectedValue(ex);
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

    await expect(useCase.execute(transactionForTest)).rejects.toBe(ex);
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('should wrap non-Http errors from external service', async () => {
    externalTransferService.sendTransfer.mockRejectedValue(new Error('boom'));
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

    await expect(useCase.execute(transactionForTest)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
  });

  it('should increment transfer_failed when persist fails', async () => {
    transactionRepository.save.mockRejectedValue(new Error('db'));
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

    await expect(useCase.execute(transactionForTest)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
  });
});
