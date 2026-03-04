import type { ExternalTransferResult } from '../../../domain/providers/external-transfer.service';

interface BrebResponseData {
  end_to_end_id?: string;
  endToEndId?: string;
  status?: string;
  properties?: {
    trace_id?: string;
    traceId?: string;
    event_date?: string;
    eventDate?: string;
  };
  qr_code_id?: string;
  qrCodeId?: string;
}

export function mapBrebResponseToTransferResult(
  data: unknown,
): ExternalTransferResult {
  if (data == null || typeof data !== 'object') {
    throw new Error('Empty response from external transfer service');
  }

  const body = data as BrebResponseData;
  const end_to_end_id = body.end_to_end_id ?? body.endToEndId;
  const status = body.status;
  const properties = body.properties ?? {};
  const trace_id = properties.trace_id ?? properties.traceId;
  const event_date = properties.event_date ?? properties.eventDate;
  const qr_code_id = body.qr_code_id ?? body.qrCodeId;

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
}
