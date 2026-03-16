import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as http2 from 'node:http2';

export const BREB_HTTP2_CLIENT = 'BrebHttp2Client';

export interface BrebHttp2Client {
  postJson(body: Record<string, unknown>): Promise<unknown>;
}

@Injectable()
export class BrebHttp2ClientImpl implements BrebHttp2Client, OnModuleDestroy {
  private readonly logger = new Logger(BrebHttp2ClientImpl.name);
  private session: http2.ClientHttp2Session | null = null;
  private readonly baseUrl: string =
    process.env.BREB_BASE_URL ?? 'http://localhost:3001/transfer';

  async postJson(requestBody: Record<string, unknown>): Promise<unknown> {
    const transactionId = (requestBody?.transaction as { id?: string })?.id;
    this.logger.log(
      `POST ${this.baseUrl} | transactionId=${transactionId ?? '-'}`,
    );

    const url = new URL(this.baseUrl);
    const path = url.pathname || '/';
    const authority = `${url.hostname}:${url.port || (url.protocol === 'https:' ? 443 : 80)}`;
    const scheme = url.protocol.replace(':', '') as 'http' | 'https';

    const session = this.getSession();
    const bodyStr = JSON.stringify(requestBody);

    return new Promise((resolve, reject) => {
      const req = session.request(
        {
          ':method': 'POST',
          ':path': path,
          ':scheme': scheme,
          ':authority': authority,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(bodyStr, 'utf8').toString(),
        },
        { endStream: false },
      );

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
        if (statusCode != null && statusCode >= 400) {
          this.logger.warn(
            `BREB HTTP error | transactionId=${transactionId ?? '-'} status=${statusCode}`,
          );
          const err = new Error(`BREB returned ${statusCode}`) as Error & {
            response?: { status?: number };
          };
          err.response = { status: statusCode };
          reject(err);
          return;
        }
        this.logger.log(
          `BREB HTTP response | transactionId=${transactionId ?? '-'} status=${statusCode ?? '-'}`,
        );
        resolve(data);
      });

      req.on('error', reject);
      req.write(bodyStr, 'utf8');
      req.end();
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeSession();
  }

  private getSession(): http2.ClientHttp2Session {
    if (this.session != null && !this.session.closed) {
      return this.session;
    }
    const url = new URL(this.baseUrl);
    const origin = `${url.protocol}//${url.hostname}:${url.port || (url.protocol === 'https:' ? 443 : 80)}`;
    this.session = http2.connect(origin);
    this.session.on('error', (err: Error) => {
      this.logger.warn(`HTTP/2 session error | ${err.message}`);
    });
    return this.session;
  }

  private async closeSession(): Promise<void> {
    if (this.session == null) return;
    return new Promise((resolve) => {
      if (this.session!.closed) {
        this.session = null;
        resolve();
        return;
      }
      this.session!.close(() => {
        this.session = null;
        resolve();
      });
    });
  }
}
