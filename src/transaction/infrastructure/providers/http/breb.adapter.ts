import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { throwHttpClientError } from './http-client-error.mapper';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../../domain/providers/external-transfer.service';
import { mapBrebResponseToTransferResult } from './breb-response.mapper';
@Injectable()
export class BrebAdapter implements ExternalTransferService {
  constructor(private readonly httpService: HttpService) {}

  async sendTransfer(
    transaction: Transaction,
  ): Promise<ExternalTransferResult> {
    const request = {
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        receiver: {
          document: transaction.receiverDocument,
          documentType: transaction.receiverDocumentType,
          name: transaction.receiverName,
          account: transaction.receiverAccount,
          accountType: transaction.receiverAccountType,
        },
      },
    };
    const brebBaseUrl =
      process.env.BREB_BASE_URL ?? 'http://localhost:3001/transfer';
      const delays = [0, 100, 300, 1000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
          if (delays[attempt] > 0) {
            await this.sleep(delays[attempt]);
          }
          const response = (await firstValueFrom(
            this.httpService.post(brebBaseUrl, request),
          )) as AxiosResponse<unknown>;
          const data: unknown = response?.data;
          return mapBrebResponseToTransferResult(data);
        } catch (err) {
          const lastAttempt = attempt === delays.length - 1;
          if (lastAttempt) {
            throwHttpClientError(err);
          }
          console.warn(`BREB retry ${attempt + 1} failed`);
        }
      }
      throw new Error('BREB transfer failed after retries');
    }
    private async sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  
