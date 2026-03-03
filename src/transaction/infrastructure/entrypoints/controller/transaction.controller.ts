import { Controller, Post, Body } from '@nestjs/common';
import { CreateTransferUseCase } from '../../../application/use-cases/create-transfer.use-case';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type { CreateTransferRequest } from '../model/create-transfer.request';
import type { CreateTransferResponse } from '../model/create-transfer.response';

@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
  ) {}

  @Post('/transfer')
  async create(
    @Body() body: CreateTransferRequest,
  ): Promise<CreateTransferResponse> {
    const transaction = this.mapRequestToEntity(body);
    const result = await this.createTransferUseCase.execute(transaction);
    return this.mapResultToResponse(result);
  }

  private mapRequestToEntity(request: CreateTransferRequest): Transaction {
    const { transaction: t } = request;
    return new Transaction(
      t.id,
      t.amount,
      t.moneda,
      t.descripcion,
      t.receptor.documento,
      t.receptor.tipoDocumento,
      t.receptor.nombre,
      t.receptor.cuenta,
      t.receptor.tipoCuenta,
      'PENDING',
    );
  }

  private mapResultToResponse(result: {
    transaction: Transaction;
    externalResponse: {
      externalId: string;
      status: string;
      traceId: string;
      qrCodeId?: string;
      eventDate?: string;
    };
  }): CreateTransferResponse {
    const { transaction, externalResponse } = result;
    return {
      id: transaction.id,
      status: transaction.status,
      end_to_end_id: externalResponse.externalId,
      qr_code_id: externalResponse.qrCodeId,
      properties: {
        event_date: externalResponse.eventDate,
        trace_id: externalResponse.traceId,
      },
    };
  }
}
