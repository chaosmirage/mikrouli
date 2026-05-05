import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { Span } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';

const DEFAULT_ENDPOINT = 'http://localhost:4318';
const DEFAULT_SERVICE_NAME = 'mikrouli-api';
const DEFAULT_VERSION = 'dev';
const REDACTED_VALUE = '[REDACTED]';

// Header names redacted in BOTH directions (overzealous on purpose: Set-Cookie
// only ever appears on responses and Authorization on requests, but blanking
// both sides is cheaper than a false negative).
const SENSITIVE_HEADER_NAMES = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
const SENSITIVE_HEADER_PREFIXES = ['http.request.header.', 'http.response.header.'];

// Network identifiers that constitute PII under GDPR (raw client IP).
const SENSITIVE_NETWORK_KEYS = [
  'http.client.ip',
  'net.peer.ip',
  'net.sock.peer.addr',
  'client.address',
  'client.socket.address',
];

// URL-like span attributes whose query strings may carry credentials.
const URL_ATTRIBUTE_KEYS = ['http.target', 'http.url', 'url.full', 'url.path'];

// Query parameter names whose values get blanked out before the URL is
// recorded as a span attribute.
const PII_QUERY_PARAMS = [
  'email',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apiKey',
];

function piiHeaderKeys(): string[] {
  const out: string[] = [];
  for (const prefix of SENSITIVE_HEADER_PREFIXES) {
    out.push(...SENSITIVE_HEADER_NAMES.map((name) => `${prefix}${name}`));
  }
  return out;
}

const PII_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set<string>([
  ...SENSITIVE_NETWORK_KEYS,
  ...piiHeaderKeys(),
]);

const URL_ATTRIBUTE_KEY_SET: ReadonlySet<string> = new Set<string>(URL_ATTRIBUTE_KEYS);

function isPiiKey(key: string): boolean {
  return PII_ATTRIBUTE_KEYS.has(key);
}

function isUrlLikeKey(key: string): boolean {
  return URL_ATTRIBUTE_KEY_SET.has(key);
}

function redactSearchParams(params: URLSearchParams): URLSearchParams {
  for (const key of PII_QUERY_PARAMS) {
    if (params.has(key)) params.set(key, REDACTED_VALUE);
  }
  return params;
}

function redactQueryString(url: string): string {
  const idx = url.indexOf('?');
  if (idx < 0) return url;
  const base = url.slice(0, idx);
  const redacted = redactSearchParams(new URLSearchParams(url.slice(idx + 1)));
  const qs = redacted.toString();
  if (qs.length === 0) return base;
  return `${base}?${qs}`;
}

function redactValueFor(key: string, value: unknown): unknown {
  if (isPiiKey(key)) return REDACTED_VALUE;
  if (typeof value === 'string' && isUrlLikeKey(key)) return redactQueryString(value);
  return value;
}

// Public PII sanitiser — receives an arbitrary span attribute map and
// returns a copy with sensitive keys replaced with [REDACTED] and URL-like
// keys with their PII query parameters blanked. Pure (no span mutation).
// Exported so tests can exercise it directly and so other modules
// (custom instrumentations, log enrichers) can reuse the same redaction.
export function sanitiseAttributes(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    out[key] = redactValueFor(key, value);
  }
  return out;
}

export interface OtelConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnv: string;
}

function readConfig(): OtelConfig {
  return {
    endpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? DEFAULT_ENDPOINT,
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? DEFAULT_SERVICE_NAME,
    serviceVersion: process.env['SERVICE_VERSION'] ?? DEFAULT_VERSION,
    deploymentEnv: process.env['NODE_ENV'] ?? 'development',
  };
}

export function buildResource(config: OtelConfig): Resource {
  return resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.deploymentEnv,
  });
}

function blankAttributesForPrefix(prefix: string): Record<string, unknown> {
  const blanks: Record<string, unknown> = {};
  for (const name of SENSITIVE_HEADER_NAMES) {
    blanks[`${prefix}${name}`] = '';
  }
  return blanks;
}

function applyAttributeMap(span: Span, map: Record<string, unknown>): void {
  const sanitised = sanitiseAttributes(map);
  for (const [key, value] of Object.entries(sanitised)) {
    span.setAttribute(key, value as string);
  }
}

function redactRequestHeaders(span: Span): void {
  applyAttributeMap(span, blankAttributesForPrefix('http.request.header.'));
}

function redactResponseHeaders(span: Span): void {
  applyAttributeMap(span, blankAttributesForPrefix('http.response.header.'));
}

function buildHttpInstrumentationConfig() {
  return {
    requestHook: (span: Span) => redactRequestHeaders(span),
    responseHook: (span: Span) => redactResponseHeaders(span),
  };
}

function buildInstrumentations() {
  const config = {
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-http': buildHttpInstrumentationConfig(),
  };
  return [getNodeAutoInstrumentations(config)];
}

export function buildSdk(config: OtelConfig): NodeSDK {
  const resource = buildResource(config);
  const traceExporter = new OTLPTraceExporter({ url: `${config.endpoint}/v1/traces` });
  return new NodeSDK({
    resource,
    traceExporter,
    instrumentations: buildInstrumentations(),
  });
}

function registerShutdownHook(sdk: NodeSDK): void {
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
}

export function attachIfEnabled(): void {
  if (process.env['OTEL_ENABLED'] !== 'true') return;
  const config = readConfig();
  const sdk = buildSdk(config);
  sdk.start();
  registerShutdownHook(sdk);
}

// Side effect: initialize when this module is first imported
attachIfEnabled();
