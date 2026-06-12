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
import { attachIfEnabled, buildResource, buildSdk, sanitiseAttributes } from './instrumentation';

const REDACTED = '[REDACTED]';

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

describe('sanitiseAttributes', () => {
  it('redacts authorization request header attribute', () => {
    const out = sanitiseAttributes({ 'http.request.header.authorization': 'Bearer xyz' });
    expect(out['http.request.header.authorization']).toBe(REDACTED);
  });

  it('redacts x-api-key request header attribute', () => {
    const out = sanitiseAttributes({ 'http.request.header.x-api-key': 'mk_secret' });
    expect(out['http.request.header.x-api-key']).toBe(REDACTED);
  });

  it('redacts cookie + set-cookie headers in both directions', () => {
    const out = sanitiseAttributes({
      'http.request.header.cookie': 'session=abc',
      'http.response.header.set-cookie': 'session=def',
    });
    expect(out['http.request.header.cookie']).toBe(REDACTED);
    expect(out['http.response.header.set-cookie']).toBe(REDACTED);
  });

  it('redacts client ip-like attributes', () => {
    const out = sanitiseAttributes({
      'http.client.ip': '1.2.3.4',
      'net.peer.ip': '::1',
      'client.address': '10.0.0.1',
    });
    expect(out['http.client.ip']).toBe(REDACTED);
    expect(out['net.peer.ip']).toBe(REDACTED);
    expect(out['client.address']).toBe(REDACTED);
  });

  it('redacts pii query params from url-like attributes', () => {
    const out = sanitiseAttributes({
      'http.target': '/login?email=a@b.com&password=hunter2&keep=ok',
    });
    const target = out['http.target'] as string;
    expect(target).not.toContain('a@b.com');
    expect(target).not.toContain('hunter2');
    expect(target).toContain('keep=ok');
  });

  it('passes non-pii attributes through unchanged', () => {
    const out = sanitiseAttributes({ 'http.method': 'GET', 'http.status_code': 200 });
    expect(out['http.method']).toBe('GET');
    expect(out['http.status_code']).toBe(200);
  });

  it('does not mutate the input object', () => {
    const input = { 'http.client.ip': '1.2.3.4', 'http.method': 'GET' };
    sanitiseAttributes(input);
    expect(input['http.client.ip']).toBe('1.2.3.4');
  });
});

describe('HTTP instrumentation requestHook — correlation ID span attribute', () => {
  // The requestHook reads the X-Correlation-ID header directly from the
  // IncomingMessage and sets app.correlation_id on the span. This keeps the
  // OTel tracing path independent of the AsyncLocalStorage-based log
  // correlation path.

  function createMockSpan() {
    const attributes: Record<string, unknown> = {};
    return {
      setAttribute: jest.fn((key: string, value: unknown) => {
        attributes[key] = value;
      }),
      attributes,
    };
  }

  it('sets app.correlation_id when X-Correlation-ID header is present', () => {
    // Build the instrumentations to capture the requestHook produced by
    // buildHttpInstrumentationConfig. The auto-instrumentations mock returns
    // an empty array, but buildHttpInstrumentationConfig is called inline
    // during buildSdk -> buildInstrumentations. We exercise the hook directly
    // by reconstructing what it does.

    // Import the module under test so the hooks are wired up. We then call
    // buildSdk to trigger buildInstrumentations -> buildHttpInstrumentationConfig.
    buildSdk(testConfig);

    // Re-import to get fresh state — but since we're in a jest env with mocks,
    // we verify by calling the hook logic directly.
    const { buildSdk: freshBuildSdk } = jest.requireActual('./instrumentation');

    // We need to access the requestHook. The cleanest way: build the config
    // directly by calling buildHttpInstrumentationConfig.
    // Since it's not exported, we verify via the observable behavior: the hook
    // sets the attribute on the span.
    const span = createMockSpan();
    const mockRequest = {
      headers: { 'x-correlation-id': 'abc-123-def' },
    } as unknown as import('http').IncomingMessage;

    // Invoke the requestHook through buildSdk which calls buildInstrumentations
    // which calls buildHttpInstrumentationConfig. The auto-instrumentations
    // mock swallows the config, so we replicate the hook's observable behavior
    // by calling the actual module function.
    //
    // The simplest user-closest approach: verify the module-level
    // buildHttpInstrumentationConfig produces a requestHook that sets the
    // attribute. Since the function is private, we exercise it via the public
    // buildSdk path and capture the call arguments from the mock.

    // Get the config passed to getNodeAutoInstrumentations
    const { getNodeAutoInstrumentations } = jest.requireMock(
      '@opentelemetry/auto-instrumentations-node',
    ) as { getNodeAutoInstrumentations: jest.Mock };

    // Clear and rebuild to capture the config
    (getNodeAutoInstrumentations as jest.Mock).mockClear();
    freshBuildSdk(testConfig);

    const capturedConfig = (getNodeAutoInstrumentations as jest.Mock).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    const httpConfig = capturedConfig['@opentelemetry/instrumentation-http'] as {
      requestHook: (span: { setAttribute: (k: string, v: unknown) => void }, request: { headers: Record<string, unknown> }) => void;
    };

    httpConfig.requestHook(span, mockRequest);

    expect(span.setAttribute).toHaveBeenCalledWith('app.correlation_id', 'abc-123-def');
  });

  it('does not set app.correlation_id when X-Correlation-ID header is absent', () => {
    const { buildSdk: freshBuildSdk } = jest.requireActual('./instrumentation');
    const { getNodeAutoInstrumentations } = jest.requireMock(
      '@opentelemetry/auto-instrumentations-node',
    ) as { getNodeAutoInstrumentations: jest.Mock };

    (getNodeAutoInstrumentations as jest.Mock).mockClear();
    freshBuildSdk(testConfig);

    const capturedConfig = (getNodeAutoInstrumentations as jest.Mock).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    const httpConfig = capturedConfig['@opentelemetry/instrumentation-http'] as {
      requestHook: (span: { setAttribute: (k: string, v: unknown) => void }, request: { headers: Record<string, unknown> }) => void;
    };

    const span = createMockSpan();
    const mockRequest = { headers: {} } as unknown as import('http').IncomingMessage;

    httpConfig.requestHook(span, mockRequest);

    expect(span.setAttribute).not.toHaveBeenCalledWith(
      'app.correlation_id',
      expect.anything(),
    );
  });
});
