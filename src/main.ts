import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({
      http2: true,
    }),
    { bufferLogs: true },
  );
  app.useLogger(logger);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(3000, '0.0.0.0');
  logger.log('Application listening on http://0.0.0.0:3000');
}

void bootstrap();
