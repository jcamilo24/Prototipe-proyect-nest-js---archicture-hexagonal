import { GetTransferByIdUseCase } from '../../../src/transaction/application/use-cases/get-transfer-by-id.use-case';
import { Transaction } from '../../../src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from '../../../src/transaction/domain/transaction-status.enum';
import type { TransactionRepository } from '../../../src/transaction/domain/providers/transaction.repository';

describe('GetTransferByIdUseCase', () => {
  let useCase: GetTransferByIdUseCase;
  let transactionRepository: { findById: jest.Mock };

  const mockTransaction = new Transaction(
    'tx-get-001',
    50000,
    'PESOS',
    'Test transfer',
    '123',
    'CC',
    'Test User',
    'acc-1',
    'Ahorros',
    TransactionStatus.CONFIRMED,
  );

  beforeEach(() => {
    transactionRepository = { findById: jest.fn().mockResolvedValue(mockTransaction) };
    useCase = new GetTransferByIdUseCase(
      transactionRepository as unknown as TransactionRepository,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should return transaction when found', async () => {
    const result = await useCase.execute('tx-get-001');

    expect(transactionRepository.findById).toHaveBeenCalledWith('tx-get-001');
    expect(result).toEqual(mockTransaction);
    expect(result?.id).toBe('tx-get-001');
    expect(result?.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('should return null when transfer not found', async () => {
    transactionRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute('non-existent');

    expect(transactionRepository.findById).toHaveBeenCalledWith('non-existent');
    expect(result).toBeNull();
  });
});
