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
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
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
import { getCorrelationId } from 'src/common/utils/correlation.util';

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
      `Request received | correlationId=${getCorrelationId() ?? '-'} idempotencyKey=${idempotencyKey} transactionId=${transactionId}`,
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
      `Response ready | correlationId=${getCorrelationId() ?? '-'} transactionId=${response?.id} status=${response?.status}`,
    );
    return response;
  }

  @Get('/:id')
  async getTransferById(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    this.logger.log(`GET transfer requested | correlationId=${getCorrelationId() ?? '-'} id=${id}`);

    const transaction = await this.getTransferByIdUseCase.execute(id);
    if (!transaction) {
      this.logger.warn(`Transfer not found, responding 404 | correlationId=${getCorrelationId() ?? '-'} id=${id}`);
      await res.status(404).send({ message: `Transfer with id ${id} not found` });
      return;
    }

    const response = mapTransactionToGetResponse(transaction);
    this.logger.log(`Transfer returned | correlationId=${getCorrelationId() ?? '-'} id=${id} status=${response.status}`);
    await res.status(200).send(response);
  }
}
