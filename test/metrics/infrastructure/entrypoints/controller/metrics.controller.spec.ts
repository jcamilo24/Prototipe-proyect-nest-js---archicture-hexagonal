import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from 'src/metrics/infrastructure/entrypoints/controller/metrics.controller';
import { PrometheusMetrics } from 'src/metrics/infrastructure/prometheus/prometheus.metrics';

describe('MetricsController', () => {
  const prometheusStub = {
    getHttpPayload: jest.fn().mockResolvedValue({
      body: '# HELP x\n',
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
    }),
  };

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
      providers: [
        { provide: 'MetricsService', useValue: metrics },
        { provide: PrometheusMetrics, useValue: prometheusStub },
      ],
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

  it('GET /metrics/prometheus returns Prometheus body and content type', async () => {
    const metrics = { getMetrics: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: 'MetricsService', useValue: metrics },
        { provide: PrometheusMetrics, useValue: prometheusStub },
      ],
    }).compile();

    const controller = module.get(MetricsController);
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.getPrometheusMetrics(res as never);

    expect(prometheusStub.getHttpPayload).toHaveBeenCalledTimes(1);
    expect(res.header).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('# HELP x\n');
  });
});
