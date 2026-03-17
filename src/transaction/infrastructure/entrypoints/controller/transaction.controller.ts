import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Logger,
  Param,
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
import { generateRequestHash } from 'src/common/utils/hash.util';
import { GetTransferResponse } from '../model/get-transfer.response';
import { GetTransferByIdUseCase } from '../../../application/use-cases/get-transfer-by-id.use-case';
import { mapTransactionToGetResponse } from './transaction-request.mapper';

@Controller('transactions')
export class TransactionController {
  private readonly logger = new Logger(TransactionController.name);

  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
    @Inject('IdempotencyService')
    private readonly idempotencyService: IdempotencyService,
    private readonly getTransferByIdUseCase: GetTransferByIdUseCase,
  ) {}

  @Post('/transfer')
  async create(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateTransferRequest,
  ): Promise<CreateTransferResponse> {
    const transactionId = body?.transaction?.id;
    this.logger.log(
      `Request received | idempotencyKey=${idempotencyKey} transactionId=${transactionId}`,
    );

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const requestHash = generateRequestHash(body);
    const response =
      await this.idempotencyService.handle<CreateTransferResponse>(
        idempotencyKey,
        requestHash,
        async () => {
          const transaction = mapRequestToEntity(body);
          const result = await this.createTransferUseCase.execute(transaction);
          return mapResultToResponse(result);
        },
      );

    this.logger.log(
      `Response ready | transactionId=${response?.id} status=${response?.status}`,
    );
    return response;
  }

  @Get('/:id')
  async getTransferById(@Param('id') id: string): Promise<GetTransferResponse> {
    this.logger.log(`GET transfer requested | id=${id}`);

    const transaction = await this.getTransferByIdUseCase.execute(id);

    const response = mapTransactionToGetResponse(transaction);

    this.logger.log(`Transfer returned | id=${id} status=${response.status}`);

    return response;
  }
}
