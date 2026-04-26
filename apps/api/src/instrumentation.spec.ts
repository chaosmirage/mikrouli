jest.mock('@opentelemetry/sdk-node', () => {
  const mockStart = jest.fn();
  const mockShutdown = jest.fn().mockResolvedValue(undefined);
  const NodeSDK = jest.fn().mockImplementation(() => ({
    start: mockStart,
    shutdown: mockShutdown,
  }));
  return { NodeSDK };
});

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}));

import { NodeSDK } from '@opentelemetry/sdk-node';
import { buildResource, buildSdk, attachIfEnabled } from './instrumentation';

const testConfig = {
  endpoint: 'http://localhost:4318',
  serviceName: 'test-service',
  serviceVersion: '1.2.3',
  deploymentEnv: 'test',
};

describe('instrumentation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['OTEL_ENABLED'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not start sdk when OTEL_ENABLED is not true', () => {
    attachIfEnabled();
    expect(NodeSDK).not.toHaveBeenCalled();
  });

  it('buildResource returns resource with configured service name and version', () => {
    const resource = buildResource(testConfig);
    expect(resource.attributes['service.name']).toBe('test-service');
    expect(resource.attributes['service.version']).toBe('1.2.3');
    expect(resource.attributes['deployment.environment']).toBe('test');
  });

  it('buildSdk initializes NodeSDK without throwing', () => {
    expect(() => buildSdk(testConfig)).not.toThrow();
    expect(NodeSDK).toHaveBeenCalledTimes(1);
  });
});
