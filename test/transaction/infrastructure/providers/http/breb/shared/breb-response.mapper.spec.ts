import { mapBrebResponseToTransferResult } from 'src/transaction/infrastructure/providers/http/breb/mappers/breb-response.mapper';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

describe('mapBrebResponseToTransferResult', () => {
  const minimal = {
    end_to_end_id: 'e2e',
    status: 'SUCCESS',
    properties: { trace_id: 't1' },
  };

  it('maps snake_case BREB payload to ExternalTransferResult', () => {
    const result = mapBrebResponseToTransferResult({
      ...minimal,
      qr_code_id: 'qr',
      properties: {
        trace_id: 't1',
        event_date: '2025-01-01T00:00:00Z',
      },
    });

    expect(result).toEqual({
      externalId: 'e2e',
      status: TransactionStatus.CONFIRMED,
      traceId: 't1',
      qrCodeId: 'qr',
      eventDate: '2025-01-01T00:00:00Z',
    });
  });

  it('accepts camelCase aliases', () => {
    const result = mapBrebResponseToTransferResult({
      endToEndId: 'e2e-camel',
      status: 'COMPLETED',
      qrCodeId: 'q',
      properties: { traceId: 'tc', eventDate: 'd' },
    });

    expect(result.externalId).toBe('e2e-camel');
    expect(result.status).toBe(TransactionStatus.CONFIRMED);
    expect(result.traceId).toBe('tc');
  });

  it('maps FAILED to FAILED status', () => {
    const result = mapBrebResponseToTransferResult({
      end_to_end_id: 'e',
      status: 'FAILED',
      properties: { trace_id: 't' },
    });

    expect(result.status).toBe(TransactionStatus.FAILED);
  });

  it('throws on empty or non-object data', () => {
    expect(() => mapBrebResponseToTransferResult(null)).toThrow(
      'Empty response',
    );
    expect(() => mapBrebResponseToTransferResult('x')).toThrow(
      'Empty response',
    );
  });

  it('throws when required fields missing', () => {
    expect(() =>
      mapBrebResponseToTransferResult({ end_to_end_id: 'only-id' }),
    ).toThrow('Invalid response structure');
  });
});
