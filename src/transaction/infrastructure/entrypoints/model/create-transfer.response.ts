export interface CreateTransferResponse {
  id: string;
  status: string;
  end_to_end_id: string;
  qr_code_id?: string;
  properties: {
    event_date?: string;
    trace_id: string;
  };
}
