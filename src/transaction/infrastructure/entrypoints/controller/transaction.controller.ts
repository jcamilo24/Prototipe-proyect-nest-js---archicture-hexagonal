import { Controller, Post, Body } from '@nestjs/common';
import { CreateTransferUseCase } from '../../../application/use-cases/create-transfer.use-case';
import { Transaction } from '../../../domain/entity/transaction.entity';
import type { CreateTransferRequest } from '../model/create-transfer.request';
import type { CreateTransferResponse } from '../model/create-transfer.response';
import { mapRequestToEntity, mapResultToResponse } from './transaction-request.mapper';

@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
  ) {}

  @Post('/transfer')
  async create(
    @Body() body: CreateTransferRequest,
  ): Promise<CreateTransferResponse> {
    const transaction = mapRequestToEntity(body);
    const result = await this.createTransferUseCase.execute(transaction);
    return mapResultToResponse(result);
  }
}
