import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type {
  ExternalTransferResult,
  ExternalTransferService,
} from '../../../domain/providers/external-transfer.service';

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
      const response = await lastValueFrom(
        this.httpService.post(brebBaseUrl, request),
      );

      if (!response || !response.data) {
        throw new Error('Empty response from external transfer service');
      } 

      const data = response.data;
      const end_to_end_id = data.end_to_end_id ?? data.endToEndId;
      const status = data.status;
      const properties = data.properties ?? {};
      const trace_id = properties.trace_id ?? properties.traceId;
      const event_date = properties.event_date ?? properties.eventDate;
      const qr_code_id = data.qr_code_id ?? data.qrCodeId;

      if (!end_to_end_id || !status || !trace_id) {
        throw new Error(
          'Invalid response structure from external service (expected end_to_end_id, status, properties.trace_id)',
        );
      }

      return {
        externalId: end_to_end_id,
        status,
        traceId: trace_id,
        qrCodeId: qr_code_id,
        eventDate: event_date,
      };
    } catch {
      throw new InternalServerErrorException(
        'External transfer service unavailable',
      );
    }
  }
}
