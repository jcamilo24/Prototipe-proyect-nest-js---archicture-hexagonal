export interface CreateTransferRequest {
  transaction: {
    id: string;
    amount: number;
    moneda: string;
    descripcion: string;
    receptor: {
      documento: string;
      tipoDocumento: string;
      nombre: string;
      cuenta: string;
      tipoCuenta: string;
    };
  };
}
