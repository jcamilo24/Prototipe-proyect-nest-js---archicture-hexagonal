import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { throwHttpClientError } from '../../../../common/errors/http-client-error.mapper';
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
        moneda: transaction.currency,
        descripcion: transaction.description,
        receptor: {
          documento: transaction.receiverDocument,
          tipoDocumento: transaction.receiverDocumentType,
          nombre: transaction.receiverName,
          cuenta: transaction.receiverAccount,
          tipoCuenta: transaction.receiverAccountType,
        },
      },
    };

    const brebBaseUrl =
      process.env.BREB_BASE_URL ?? 'http://localhost:3001/transfer';

    try {
      const response = await firstValueFrom(
        this.httpService.post(brebBaseUrl, request),
      );
      const data = response?.data;
      return mapBrebResponseToTransferResult(data);
    } catch (err) {
      throwHttpClientError(err);
    }
  }
}
