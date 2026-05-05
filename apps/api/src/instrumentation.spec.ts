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
