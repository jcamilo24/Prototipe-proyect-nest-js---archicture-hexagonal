import { ConfigService } from '@nestjs/config';
import { getMongoUri } from 'src/config/mongo/mongo.config';

describe('getMongoUri', () => {
  it('returns default URI when not production and MONGO_URI unset', () => {
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? 'development' : undefined),
    } as unknown as ConfigService;

    expect(getMongoUri(config)).toBe('mongodb://localhost:27017/practice-project');
  });

  it('returns trimmed MONGO_URI when set', () => {
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'MONGO_URI') return '  mongodb://custom/db  ';
        return undefined;
      },
    } as unknown as ConfigService;

    expect(getMongoUri(config)).toBe('mongodb://custom/db');
  });

  it('throws when production and MONGO_URI missing', () => {
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'MONGO_URI') return undefined;
        return undefined;
      },
    } as unknown as ConfigService;

    expect(() => getMongoUri(config)).toThrow(/MONGO_URI must be set/);
  });
});
