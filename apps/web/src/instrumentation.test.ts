import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const mockRegister = vi.fn();
const MockWebTracerProvider = vi.fn().mockImplementation(() => ({
  register: mockRegister,
  addSpanProcessor: vi.fn(),
}));
const MockBatchSpanProcessor = vi.fn();
const MockOTLPTraceExporter = vi.fn();
const mockRegisterInstrumentations = vi.fn();
const MockDocumentLoad = vi.fn();
const MockFetch = vi.fn();
const MockUserInteraction = vi.fn();
const MockZoneContextManager = vi.fn();

vi.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: MockWebTracerProvider,
  BatchSpanProcessor: MockBatchSpanProcessor,
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: MockOTLPTraceExporter,
}));
vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: mockRegisterInstrumentations,
}));
vi.mock('@opentelemetry/instrumentation-document-load', () => ({
  DocumentLoadInstrumentation: MockDocumentLoad,
}));
vi.mock('@opentelemetry/instrumentation-fetch', () => ({
  FetchInstrumentation: MockFetch,
}));
vi.mock('@opentelemetry/instrumentation-user-interaction', () => ({
  UserInteractionInstrumentation: MockUserInteraction,
}));
vi.mock('@opentelemetry/context-zone', () => ({
  ZoneContextManager: MockZoneContextManager,
}));

const disabledConfig = {
  enabled: false,
  endpoint: 'http://localhost:4318',
  serviceVersion: 'dev',
  deploymentEnv: 'test',
};

const enabledConfig = {
  enabled: true,
  endpoint: 'http://localhost:4318',
  serviceVersion: '2.0.0',
  deploymentEnv: 'test',
};

describe('web instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setupTelemetryForConfig is a no-op when disabled', async () => {
    const { setupTelemetryForConfig } = await import('./instrumentation');
    setupTelemetryForConfig(disabledConfig);
    expect(MockWebTracerProvider).not.toHaveBeenCalled();
    expect(mockRegisterInstrumentations).not.toHaveBeenCalled();
  });

  it('buildWebResource includes service.name mikrouli-web', async () => {
    const { buildWebResource } = await import('./instrumentation');
    const resource = buildWebResource(enabledConfig);
    const serviceName = resource.attributes[SemanticResourceAttributes.SERVICE_NAME];
    expect(serviceName).toBe('mikrouli-web');
    expect(resource.attributes[SemanticResourceAttributes.SERVICE_VERSION]).toBe('2.0.0');
  });
});
