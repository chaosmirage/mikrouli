import { trace } from '@opentelemetry/api';

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  [key: string]: unknown;
}

// Pulls trace_id / span_id from the OTel active span if one is open.
// Returns null when no span is active or when the context is empty
// (e.g. instrumentation disabled, log emitted before SDK boot).
export function getTraceContext(): TraceContext | null {
  const span = trace.getActiveSpan();
  if (span === undefined) return null;
  const ctx = span.spanContext();
  if (ctx.traceId.length === 0) return null;
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

// Convenience wrapper: merges traceId + spanId into a payload object
// without mutating the input. Empty payload is fine.
export function withTraceFields(payload: LogPayload = {}): LogPayload {
  const ctx = getTraceContext();
  if (ctx === null) return payload;
  return { traceId: ctx.traceId, spanId: ctx.spanId, ...payload };
}

// Single-line JSON suitable for stdout structured logs that downstream
// log shippers (Loki / Vector / Promtail) can correlate with traces.
export function formatLogWithTrace(
  level: LogLevel,
  message: string,
  payload?: LogPayload,
): string {
  const record = withTraceFields(payload);
  return JSON.stringify({ level, message, ...record });
}
