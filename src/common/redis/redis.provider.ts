import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new Redis({
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10),
    });
  },
  inject: [ConfigService],
};
