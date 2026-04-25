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
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

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

function redactRequestHeaders(span: Span): void {
  SENSITIVE_HEADERS.forEach((header) => {
    span.setAttribute(`http.request.header.${header}`, REDACTED_VALUE);
  });
}

function redactResponseHeaders(span: Span): void {
  SENSITIVE_HEADERS.forEach((header) => {
    span.setAttribute(`http.response.header.${header}`, REDACTED_VALUE);
  });
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
