import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http2 from 'node:http2';
import { getCorrelationId } from 'src/common/utils/correlation.util';
import {
  createBrebHttpCircuitBreaker,
  type BrebHttpCircuitBreakerInstance,
} from '../shared/breb-circuit-breaker.factory';
import { getBrebCircuitBreakerOptions } from '../shared/breb-circuit-breaker.options';

export const BREB_HTTP2_CLIENT_V1 = 'BrebHttp2ClientV1';
export const BREB_HTTP2_CLIENT_V2 = 'BrebHttp2ClientV2';

export const BREB_HTTP2_CLIENT = BREB_HTTP2_CLIENT_V1;

export interface BrebHttp2Client {
  postJson(body: Record<string, unknown>): Promise<unknown>;
  getJson(path: string): Promise<unknown>;
}

type RequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  authority: string;
  scheme: 'http' | 'https';
  body?: string;
};

@Injectable()
export class BrebHttp2ClientImpl implements BrebHttp2Client, OnModuleDestroy {
  private readonly logger = new Logger(BrebHttp2ClientImpl.name);
  private readonly breaker: BrebHttpCircuitBreakerInstance;
  private session: http2.ClientHttp2Session | null = null;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl;
    const options = getBrebCircuitBreakerOptions(this.configService);
    this.breaker = createBrebHttpCircuitBreaker(this.logger, options);
  }

  async postJson(requestBody: Record<string, unknown>): Promise<unknown> {
    return this.breaker.fire(() => this.doPostJson(requestBody));
  }

  async getJson(subPath: string): Promise<unknown> {
    return this.breaker.fire(() => this.doGetJson(subPath));
  }

  private async doPostJson(requestBody: Record<string, unknown>): Promise<unknown> {
    const transactionId = (requestBody?.transaction as { id?: string })?.id;
    this.logger.debug(
      `POST ${this.baseUrl} | correlationId=${getCorrelationId() ?? '-'} transactionId=${transactionId ?? '-'}`,
    );
    const { path, authority, scheme } = this.getRequestTarget();
    return this.request(
      {
        method: 'POST',
        path,
        authority,
        scheme,
        body: JSON.stringify(requestBody),
      },
      `transactionId=${transactionId ?? '-'}`,
    );
  }

  private async doGetJson(subPath: string): Promise<unknown> {
    const path = this.buildPath(subPath);
    this.logger.debug(`GET ${this.baseUrl}${path} | correlationId=${getCorrelationId() ?? '-'} path=${subPath}`);
    const { authority, scheme } = this.getRequestTarget();
    return this.request(
      { method: 'GET', path, authority, scheme },
      `path=${subPath}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeSession();
  }

  private getRequestTarget(): {
    path: string;
    authority: string;
    scheme: 'http' | 'https';
  } {
    const url = new URL(this.baseUrl);
    const path = url.pathname || '/';
    const authority = `${url.hostname}:${url.port || (url.protocol === 'https:' ? 443 : 80)}`;
    const scheme = url.protocol.replace(':', '') as 'http' | 'https';
    return { path, authority, scheme };
  }

  private buildPath(subPath: string): string {
    const url = new URL(this.baseUrl);
    const basePath = url.pathname?.replace(/\/$/, '') || '/';
    const segment = subPath.replace(/^\//, '') || '';
    return segment ? `${basePath}/${segment}` : basePath;
  }

  private request(
    options: RequestOptions,
    logContext: string,
  ): Promise<unknown> {
    const { method, path, authority, scheme, body } = options;
    const session = this.getSession();

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        ':method': method,
        ':path': path,
        ':scheme': scheme,
        ':authority': authority,
        'x-correlation-id': getCorrelationId() ?? '',
      };
      if (body) {
        headers['content-type'] = 'application/json';
        headers['content-length'] = Buffer.byteLength(body, 'utf8').toString();
      }

      const req = session.request(headers, {
        endStream: !body,
      });

      let statusCode: number | undefined;
      const chunks: Buffer[] = [];

      req.on('response', (headers) => {
        const status = headers[':status'];
        statusCode = typeof status === 'string' ? parseInt(status, 10) : status;
      });

      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data: unknown;
        try {
          data = raw ? JSON.parse(raw) : undefined;
        } catch {
          reject(new Error('Invalid JSON response from BREB'));
          return;
        }
        const isErrorStatus = statusCode != null && statusCode >= 400;
        if (isErrorStatus) {
          this.logger.warn(
            `BREB HTTP error | correlationId=${getCorrelationId() ?? '-'} ${logContext} status=${statusCode}`,
          );
          const err = new Error(`BREB returned ${statusCode}`) as Error & {
            response?: { status?: number };
          };
          err.response = { status: statusCode };
          reject(err);
          return;
        }
        this.logger.log(
          `BREB HTTP response | correlationId=${getCorrelationId() ?? '-'} ${logContext} status=${statusCode ?? '-'}`,
        );
        resolve(data);
      });

      req.on('error', reject);
      if (body) {
        req.write(body, 'utf8');
      }
      req.end();
    });
  }

  private getSession(): http2.ClientHttp2Session {
    if (this.session != null && !this.session.closed) {
      return this.session;
    }
    const url = new URL(this.baseUrl);
    const origin = `${url.protocol}//${url.hostname}:${url.port || (url.protocol === 'https:' ? 443 : 80)}`;
    this.session = http2.connect(origin);
    this.session.on('error', (err: Error) => {
      this.logger.warn(`HTTP/2 session error | correlationId=${getCorrelationId() ?? '-'} ${err.message}`);
    });
    return this.session;
  }

  private async closeSession(): Promise<void> {
    if (this.session == null) return;
    const session = this.session;
    this.session = null;
    return new Promise((resolve) => {
      if (session.closed) {
        resolve();
        return;
      }
      session.close(() => resolve());
    });
  }
}
