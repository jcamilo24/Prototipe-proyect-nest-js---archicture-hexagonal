import { Transaction } from '../entity/transaction.entity';

export interface TransactionRepository {
  save(tx: Transaction): Promise<void>;
}
