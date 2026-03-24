import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { getMongoUri } from './config/mongo/mongo.config';
import { TransactionModule } from './transaction/transaction.module';
import { CorrelationIdInterceptor } from './transaction/infrastructure/providers/http/interceptors/correlation-id.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
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
