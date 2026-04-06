import { ConfigService } from "@nestjs/config";

export function resolveBrebV1BaseUrl(config: ConfigService): string {
    return (
      config.get<string>('BREB_V1_BASE_URL') ??
      config.get<string>('BREB_BASE_URL') ??
      'http://localhost:3001/transfer'
    );
  }
  
  export function resolveBrebV2BaseUrl(config: ConfigService): string {
    return (
      config.get<string>('BREB_V2_BASE_URL') ??
      'http://localhost:3001/payments'
    );
  }