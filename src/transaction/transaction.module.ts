import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionController } from './infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from './application/use-cases/create-transfer.use-case';
import { BrebAdapter } from './infrastructure/providers/http/breb.adapter';
import { TransactionRepositoryImpl } from './infrastructure/providers/persistence/transaction.repository';
import {
  TransactionDocument,
  TransactionSchema,
} from './infrastructure/providers/persistence/transaction.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: TransactionDocument.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [TransactionController],
  providers: [
    CreateTransferUseCase,
    {
      provide: 'TransactionRepository',
      useClass: TransactionRepositoryImpl,
    },
    {
      provide: 'ExternalTransferService',
      useClass: BrebAdapter,
    },
  ],
})
export class TransactionModule {}
