import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionController } from './infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from './application/use-cases/create-transfer.use-case';
import { BrebAdapter } from './infrastructure/providers/http/breb.service';
import {
  BREB_HTTP2_CLIENT,
  BrebHttp2ClientImpl,
} from './infrastructure/providers/http/breb-http2.client';
import { TransactionRepositoryImpl } from './infrastructure/providers/persistence/transaction.repository';
import {
  TransactionDocument,
  TransactionSchema,
} from './infrastructure/providers/persistence/transaction.schema';
import { RedisProvider } from 'src/config/redis/redis.provider';
import { RedisIdempotencyService } from './infrastructure/idempotency/redis-idempotency.service';
import { GetTransferByIdUseCase } from './application/use-cases/get-transfer-by-id.use-case';
import { TransactionRepository } from './domain/providers/transaction.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TransactionDocument.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [TransactionController],
  providers: [
    RedisProvider,
    {
      provide: 'IdempotencyService',
      useClass: RedisIdempotencyService,
    },
    {
      provide: CreateTransferUseCase,
      useFactory: (
        transactionRepository: TransactionRepositoryImpl,
        externalTransferService: BrebAdapter,
      ) =>
        new CreateTransferUseCase(
          transactionRepository,
          externalTransferService,
        ),
      inject: ['TransactionRepository', 'ExternalTransferService'],
    },
    {
      provide: GetTransferByIdUseCase,
      useFactory: (transactionRepository: TransactionRepositoryImpl) =>
        new GetTransferByIdUseCase(transactionRepository),
      inject: ['TransactionRepository'],
    },
    {
      provide: 'TransactionRepository',
      useClass: TransactionRepositoryImpl,
    },
    {
      provide: 'ExternalTransferService',
      useClass: BrebAdapter,
    },
    {
      provide: BREB_HTTP2_CLIENT,
      useClass: BrebHttp2ClientImpl,
    },
  ],
})
export class TransactionModule {}
