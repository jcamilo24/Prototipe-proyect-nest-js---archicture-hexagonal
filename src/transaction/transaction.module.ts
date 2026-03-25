import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionController } from './infrastructure/entrypoints/controller/transaction.controller';
import { CreateTransferUseCase } from './application/use-cases/create-transfer.use-case';
import { BrebV1Adapter } from './infrastructure/providers/http/breb/v1/breb-v1.adapter';
import { BrebV2Adapter } from './infrastructure/providers/http/breb/v2/breb-v2.adapter';
import {
  BREB_HTTP2_CLIENT_V1,
  BREB_HTTP2_CLIENT_V2,
  BrebHttp2ClientImpl,
} from './infrastructure/providers/http/breb/client/breb-http2.client';
import { resolveBrebV1BaseUrl, resolveBrebV2BaseUrl } from './infrastructure/providers/http/breb/config/breb-http2.config';
import { TransactionRepositoryImpl } from './infrastructure/providers/persistence/transaction.repository';
import {
  TransactionDocument,
  TransactionSchema,
} from './infrastructure/providers/persistence/transaction.schema';
import { RedisIdempotencyService } from './infrastructure/idempotency/redis-idempotency.service';
import { GetTransferByIdUseCase } from './application/use-cases/get-transfer-by-id.use-case';
import { TransactionRepository } from './domain/providers/transaction.repository';
import type { ExternalTransferService } from './domain/providers/external-transfer.service';
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
      provide: BREB_HTTP2_CLIENT_V1,
      useFactory: (config: ConfigService) =>
        new BrebHttp2ClientImpl(config, resolveBrebV1BaseUrl(config)),
      inject: [ConfigService],
    },
    {
      provide: BREB_HTTP2_CLIENT_V2,
      useFactory: (config: ConfigService) =>
        new BrebHttp2ClientImpl(config, resolveBrebV2BaseUrl(config)),
      inject: [ConfigService],
    },
    BrebV1Adapter,
    BrebV2Adapter,
    {
      provide: 'ExternalTransferService',
      useFactory: (
        config: ConfigService,
        v1: BrebV1Adapter,
        v2: BrebV2Adapter,
      ): ExternalTransferService => {
        const version = (
          config.get<string>('BREB_ADAPTER_VERSION') ?? 'v1'
        ).toLowerCase();
        return version === 'v2' ? v2 : v1;
      },
      inject: [ConfigService, BrebV1Adapter, BrebV2Adapter],
    },
    {
      provide: CreateTransferUseCase,
      useFactory: (
        transactionRepository: TransactionRepositoryImpl,
        externalTransferService: ExternalTransferService,
        metricsService: MetricsServicePort,
      ) =>
        new CreateTransferUseCase(
          transactionRepository,
          externalTransferService,
          metricsService,
        ),
      inject: ['TransactionRepository', 'ExternalTransferService', 'MetricsService'],
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
