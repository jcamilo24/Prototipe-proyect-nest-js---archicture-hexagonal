import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { getMongoUri } from './config/mongo/mongo.config';
import { TransactionModule } from './transaction/transaction.module';
import { CorrelationIdInterceptor } from './transaction/infrastructure/providers/http/interceptors/correlation-id.interceptor';
import { UnsupportedCurrencyExceptionFilter } from './transaction/infrastructure/entrypoints/filters/unsupported-currency.exception-filter';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: UnsupportedCurrencyExceptionFilter,
    },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: getMongoUri(configService),
      }),
      inject: [ConfigService],
    }),
    TransactionModule,
  ],
})
export class AppModule {}
