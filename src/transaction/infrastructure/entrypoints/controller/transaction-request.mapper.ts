import { BadRequestException } from '@nestjs/common';
import { Transaction } from 'src/transaction/domain/entity/transaction.entity';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';
import { CreateTransferRequest } from '../model/create-transfer.request';
import { CreateTransferResponse } from '../model/create-transfer.response';

type IncomingTransactionBody = CreateTransferRequest['transaction'] & {
  receptor?: {
    documento?: string;
    tipoDocumento?: string;
    nombre?: string;
    cuenta?: string;
    tipoCuenta?: string;
  };
  moneda?: string;
  descripcion?: string;
};

type ReceiverLike =
  | { document?: string; documentType?: string; name?: string; account?: string; accountType?: string }
  | { documento?: string; tipoDocumento?: string; nombre?: string; cuenta?: string; tipoCuenta?: string };

function getReceiverFields(t: IncomingTransactionBody) {
  const receiver = (t.receiver ?? t.receptor) as ReceiverLike | undefined;
  if (!receiver) {
    throw new BadRequestException(
      'transaction.receiver or transaction.receptor is required',
    );
  }
  const r = receiver as Record<string, string | undefined>;
  return {
    document: r.document ?? r.documento ?? '',
    documentType: r.documentType ?? r.tipoDocumento ?? '',
    name: r.name ?? r.nombre ?? '',
    account: r.account ?? r.cuenta ?? '',
    accountType: r.accountType ?? r.tipoCuenta ?? '',
  };
}

export function mapRequestToEntity(request: CreateTransferRequest): Transaction {
  const t = request.transaction as IncomingTransactionBody;
  const { document, documentType, name, account, accountType } =
    getReceiverFields(t);
  const currency = t.currency ?? t.moneda ?? '';
  const description = t.description ?? t.descripcion ?? '';

  return new Transaction(
    t.id,
    t.amount,
    currency,
    description,
    document,
    documentType,
    name,
    account,
    accountType,
    TransactionStatus.PENDING,
  );
}

export function mapResultToResponse(result: {
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