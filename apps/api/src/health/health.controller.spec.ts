import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

const moduleMetadata: ModuleMetadata = {
  controllers: [HealthController],
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    controller = moduleRef.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health returns { status: "ok" }', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
