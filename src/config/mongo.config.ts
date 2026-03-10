import { ConfigService } from '@nestjs/config';

const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/practice-project';

/**
 * Returns the MongoDB URI for Mongoose.
 * - Development: uses MONGO_URI from env or default localhost.
 * - Production: requires MONGO_URI; throws if missing.
 */
export function getMongoUri(configService: ConfigService): string {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const isProduction = nodeEnv === 'production';

  const envUri = configService.get<string>('MONGO_URI');

  if (isProduction && (envUri == null || envUri.trim() === '')) {
    throw new Error(
      'MONGO_URI must be set in production. Do not use localhost default.',
    );
  }

  return envUri?.trim() ?? DEFAULT_MONGO_URI;
}
