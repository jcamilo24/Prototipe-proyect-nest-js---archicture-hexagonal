import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionController } from './infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from './application/use-cases/create-transfer.use-case';
import { BrebV1Adapter } from './infrastructure/providers/http/breb/v1/breb-v1.adapter';
import { BrebV2Adapter } from './infrastructure/providers/http/breb/v2/breb-v2.adapter';
import {
  HTTP2_CLIENT_V1,
  HTTP2_CLIENT_V2,
  Http2ClientImpl,
} from './infrastructure/providers/http/client/http2.client';
import { resolveBrebV1BaseUrl, resolveBrebV2BaseUrl } from '../config/breb/breb-http2.config';
import { resolveTransferFeeRates } from '../config/transfer-fee/transfer-fee.config';
import { TransactionRepositoryImpl } from './infrastructure/providers/persistence/transaction.repository';
import {
  TransactionDocument,
  TransactionSchema,
} from './infrastructure/providers/persistence/transaction.schema';
import { RedisIdempotencyService } from './infrastructure/idempotency/redis-idempotency.service';
import { GetTransferByIdUseCase } from './application/use-cases/get-transfer-by-id.use-case';
import { TransactionRepository } from './domain/providers/transaction.repository';
import { TransferFeeCalculator } from './domain/transfer-fee.calculator';
import { MetricsModule } from 'src/metrics/metrics.module';
import { MetricsServicePort } from 'src/metrics/domain/providers/metrics.service.provider';
import { RedisModule } from 'src/config/redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TransactionDocument.name, schema: TransactionSchema },
    ]),
    MetricsModule,
    RedisModule,
  ],
  controllers: [TransactionController],
  providers: [
    {
      provide: 'IdempotencyService',
      useClass: RedisIdempotencyService,
    },
    {
      provide: HTTP2_CLIENT_V1,
      useFactory: (config: ConfigService) =>
        new Http2ClientImpl(config, resolveBrebV1BaseUrl(config)),
      inject: [ConfigService],
    },
    {
      provide: HTTP2_CLIENT_V2,
      useFactory: (config: ConfigService) =>
        new Http2ClientImpl(config, resolveBrebV2BaseUrl(config)),
      inject: [ConfigService],
    },
    BrebV1Adapter,
    BrebV2Adapter,
    {
      provide: TransferFeeCalculator,
      useFactory: (config: ConfigService) =>
        new TransferFeeCalculator(resolveTransferFeeRates(config)),
      inject: [ConfigService],
    },
    {
      provide: CreateTransferUseCase,
      useFactory: (
        transactionRepository: TransactionRepositoryImpl,
        brebV1Adapter: BrebV1Adapter,
        brebV2Adapter: BrebV2Adapter,
        metricsService: MetricsServicePort,
        transferFeeCalculator: TransferFeeCalculator,
      ) =>
        new CreateTransferUseCase(
          transactionRepository,
          brebV1Adapter,
          brebV2Adapter,
          metricsService,
          transferFeeCalculator,
        ),
      inject: [
        'TransactionRepository',
        BrebV1Adapter,
        BrebV2Adapter,
        'MetricsService',
        TransferFeeCalculator,
      ],
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
  ],
})
export class TransactionModule {}
