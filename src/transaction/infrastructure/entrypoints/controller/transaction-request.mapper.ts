import { BadRequestException } from '@nestjs/common';
import { parseTransactionCurrency } from 'src/transaction/domain/currency.enum';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import type { ExternalTransferResult } from 'src/transaction/domain/providers/external-transfer.service';
import { CreateTransferRequest } from '../model/create-transfer.request';
import { CreateTransferResponse } from '../model/create-transfer.response';
import { GetTransferResponse } from '../model/get-transfer.response';

export function mapRequestToEntity(
  request: CreateTransferRequest,
): Transaction {
  const t = request.transaction;

  if (!t.receiver) {
    throw new BadRequestException('transaction.receiver is required');
  }

  const { document, documentType, name, account, accountType } = t.receiver;

  const currency = parseTransactionCurrency(t.id, t.currency);

  return new Transaction(
    t.id,
    t.amount,
    currency,
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
    fee: transaction.fee,
  };
}

export function mapTransactionToGetResponse(
  transaction: Transaction,
): GetTransferResponse {
  return {
    id: transaction.id,
    status: transaction.status,
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
    transactionDate: transaction.transactionDate,
    finalizedAt: transaction.finalizedAt ?? undefined,
  };
}
