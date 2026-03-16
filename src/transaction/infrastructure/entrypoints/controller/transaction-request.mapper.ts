import { BadRequestException } from '@nestjs/common';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import type { ExternalTransferResult } from 'src/transaction/domain/providers/external-transfer.service';
import { CreateTransferRequest } from '../model/create-transfer.request';
import { CreateTransferResponse } from '../model/create-transfer.response';

export function mapRequestToEntity(
  request: CreateTransferRequest,
): Transaction {
  const t = request.transaction;

  if (!t.receiver) {
    throw new BadRequestException('transaction.receiver is required');
  }

  const { document, documentType, name, account, accountType } = t.receiver;

  return new Transaction(
    t.id,
    t.amount,
    t.currency,
    t.description,
    document,
    documentType,
    name,
    account,
    accountType,
    TransactionStatus.CREATED,
  );
}

export function mapResultToResponse(result: {
  transaction: Transaction;
  externalResponse: ExternalTransferResult;
}): CreateTransferResponse {
  const { transaction, externalResponse } = result;
  return {
    id: transaction.id,
    status: transaction.status,
    endToEndId: externalResponse.externalId,
    qrCodeId: externalResponse.qrCodeId,
    properties: {
      eventDate: externalResponse.eventDate,
      traceId: externalResponse.traceId,
    },
  };
}
