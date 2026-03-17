import { Transaction } from '../entity/transaction.entity';

export type TransactionRepository = {
  save(tx: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
}
