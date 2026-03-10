import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Post,
} from '@nestjs/common';
import { CreateTransferUseCase } from '../../../application/use-cases/create-transfer.use-case';
import type { IdempotencyService } from '../../../domain/providers/idempotency.service';
import type { CreateTransferRequest } from '../model/create-transfer.request';
import type { CreateTransferResponse } from '../model/create-transfer.response';
import {
  mapRequestToEntity,
  mapResultToResponse,
} from './transaction-request.mapper';
import { generateRequestHash } from 'src/common/helpers/hash.helper';

@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
    @Inject('IdempotencyService')
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('/transfer')
  async create(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateTransferRequest,
  ): Promise<CreateTransferResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const requestHash = generateRequestHash(body);
    return this.idempotencyService.handle<CreateTransferResponse>(
      idempotencyKey,
      requestHash,
      async () => {
        const transaction = mapRequestToEntity(body);
        const result = await this.createTransferUseCase.execute(transaction);
        return mapResultToResponse(result);
      },
    );
  }
}
