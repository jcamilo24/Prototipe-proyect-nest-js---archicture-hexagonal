import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from 'src/metrics/infrastructure/entrypoints/controller/metrics.controller';

describe('MetricsController', () => {
  it('GET /metrics delegates to MetricsService.getMetrics', async () => {
    const metrics = {
      getMetrics: jest.fn().mockResolvedValue({
        transfer_created: 1,
        transfer_failed: 0,
        breb_calls: 2,
        breb_errors: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: 'MetricsService', useValue: metrics }],
    }).compile();

    const controller = module.get(MetricsController);
    const result = await controller.getMetrics();

    expect(metrics.getMetrics).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      transfer_created: 1,
      transfer_failed: 0,
      breb_calls: 2,
      breb_errors: 0,
    });
  });
});
