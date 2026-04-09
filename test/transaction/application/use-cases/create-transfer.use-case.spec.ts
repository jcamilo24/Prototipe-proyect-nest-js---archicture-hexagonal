import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { CreateTransferUseCase } from 'src/transaction/application/use-cases/create-transfer.use-case';
import { Currency } from 'src/transaction/domain/currency.enum';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { TransferFeeCalculator } from 'src/transaction/domain/transfer-fee.calculator';
import type { ExternalTransferService } from 'src/transaction/domain/providers/external-transfer.service';
import type { TransactionRepository } from 'src/transaction/domain/providers/transaction.repository';

describe('CreateTransferUseCase', () => {
  let useCase: CreateTransferUseCase;
  let transactionRepository: { save: jest.Mock };
  let externalTransferV1: { sendTransfer: jest.Mock };
  let externalTransferV2: { sendTransfer: jest.Mock };
  let metricsService: {
    increment: jest.Mock;
    getMetrics: jest.Mock;
  };

  const mockTransaction = new Transaction(
    'tx-001',
    100000,
    Currency.USD,
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
    externalTransferV1 = {
      sendTransfer: jest.fn().mockResolvedValue(mockExternalResponse),
    };
    externalTransferV2 = {
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
      externalTransferV1 as unknown as ExternalTransferService,
      externalTransferV2 as unknown as ExternalTransferService,
      metricsService satisfies MetricsServicePort,
      new TransferFeeCalculator({ copRate: 0.01, usdRate: 0.02 }),
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call external transfer service and then save transaction', async () => {
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );
    const result = await useCase.execute(transactionForTest, 'v1');

    expect(externalTransferV1.sendTransfer).toHaveBeenCalledTimes(1);
    expect(externalTransferV1.sendTransfer).toHaveBeenCalledWith(
      transactionForTest,
    );
    expect(externalTransferV2.sendTransfer).not.toHaveBeenCalled();
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

  it('should use v2 external service when brebVersion is v2', async () => {
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );
    await useCase.execute(transactionForTest, 'v2');

    expect(externalTransferV2.sendTransfer).toHaveBeenCalledWith(
      transactionForTest,
    );
    expect(externalTransferV1.sendTransfer).not.toHaveBeenCalled();
  });

  it('should default to v1 external service when brebVersion is invalid', async () => {
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );
    await useCase.execute(transactionForTest, 'v3');

    expect(externalTransferV1.sendTransfer).toHaveBeenCalledWith(
      transactionForTest,
    );
    expect(externalTransferV2.sendTransfer).not.toHaveBeenCalled();
  });

  it('should default to v1 when brebVersion is empty', async () => {
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );
    await useCase.execute(transactionForTest, '');

    expect(externalTransferV1.sendTransfer).toHaveBeenCalledTimes(1);
    expect(externalTransferV2.sendTransfer).not.toHaveBeenCalled();
  });

  it('should return transaction with updated status from external response', async () => {
    externalTransferV1.sendTransfer.mockResolvedValue({
      ...mockExternalResponse,
      status: TransactionStatus.CONFIRMED,
    });

    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );
    const result = await useCase.execute(transactionForTest, 'v1');

    expect(result.transaction.status).toBe(TransactionStatus.CONFIRMED);
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: TransactionStatus.CONFIRMED }),
    );
  });

  it('should map unsupported currency to BadRequest via throwUseCaseBadRequest before external service', async () => {
    const transactionForTest = new Transaction(
      'tx-bad-currency',
      1000,
      'EUR' as unknown as Currency,
      'x',
      '1',
      'CC',
      'Name',
      'acc',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    const err = await useCase
      .execute(transactionForTest, 'v1')
      .then(
        () => {
          throw new Error('expected execute to reject');
        },
        (e) => e,
      );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(metricsService.increment).not.toHaveBeenCalledWith(
      'transfer_failed',
    );
    expect(externalTransferV1.sendTransfer).not.toHaveBeenCalled();
    expect(externalTransferV2.sendTransfer).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('should rethrow HttpException from external service and increment transfer_failed', async () => {
    const ex = new BadGatewayException('upstream');
    externalTransferV1.sendTransfer.mockRejectedValue(ex);
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    await expect(useCase.execute(transactionForTest, 'v1')).rejects.toBe(ex);
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('should wrap non-Http errors from external service', async () => {
    externalTransferV1.sendTransfer.mockRejectedValue(new Error('boom'));
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    await expect(useCase.execute(transactionForTest, 'v1')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
  });

  it('should increment transfer_failed when persist fails', async () => {
    transactionRepository.save.mockRejectedValue(new Error('db'));
    const transactionForTest = new Transaction(
      'tx-001',
      100000,
      Currency.USD,
      'Recarga',
      '123456',
      'CC',
      'Juan Pérez',
      '1234567890',
      'Ahorros',
      TransactionStatus.CREATED,
    );

    await expect(useCase.execute(transactionForTest, 'v1')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(metricsService.increment).toHaveBeenCalledWith('transfer_failed');
  });
});
