/// <reference types="vite/client" />
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import type { Span } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';

const OTEL_SERVICE_NAME = 'mikrouli-web';
const DEFAULT_ENDPOINT = 'http://localhost:4318';
const DEFAULT_VERSION = 'dev';
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie'];

export interface WebOtelConfig {
  enabled: boolean;
  endpoint: string;
  serviceVersion: string;
  deploymentEnv: string;
}

export function readWebConfig(): WebOtelConfig {
  return {
    enabled: import.meta.env['VITE_OTEL_ENABLED'] === 'true',
    endpoint: (import.meta.env['VITE_OTEL_EXPORTER_OTLP_ENDPOINT'] as string) ?? DEFAULT_ENDPOINT,
    serviceVersion: (import.meta.env['VITE_SERVICE_VERSION'] as string) ?? DEFAULT_VERSION,
    deploymentEnv: (import.meta.env['MODE'] as string) ?? 'development',
  };
}

export function buildWebResource(config: WebOtelConfig): Resource {
  return resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: OTEL_SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.deploymentEnv,
  });
}

function redactSensitiveAttributes(span: Span): void {
  SENSITIVE_HEADERS.forEach((header) => {
    span.setAttribute(`http.request.header.${header}`, REDACTED_VALUE);
  });
}

function buildFetchOptions() {
  return {
    propagateTraceHeaderCorsUrls: [/.*/],
    clearTimingResources: true,
    applyCustomAttributesOnSpan: (span: Span) => redactSensitiveAttributes(span),
  };
}

function buildWebProvider(config: WebOtelConfig): WebTracerProvider {
  const resource = buildWebResource(config);
  const exporter = new OTLPTraceExporter({ url: `${config.endpoint}/v1/traces` });
  const processor = new BatchSpanProcessor(exporter);
  return new WebTracerProvider({ resource, spanProcessors: [processor] });
}

function buildWebInstrumentations() {
  return [
    new DocumentLoadInstrumentation(),
    new FetchInstrumentation(buildFetchOptions()),
    new UserInteractionInstrumentation(),
  ];
}

export function setupTelemetryForConfig(config: WebOtelConfig): void {
  if (!config.enabled) return;
  const provider = buildWebProvider(config);
  provider.register({ contextManager: new ZoneContextManager() });
  registerInstrumentations({ instrumentations: buildWebInstrumentations() });
}

// Side effect: initialize when this module is first imported
setupTelemetryForConfig(readWebConfig());
