# 0009 - End-to-End OpenTelemetry Tracing

**Status:** Accepted

## Context

Diagnosing latency and errors across a system with a separate API and frontend
application requires distributed traces that span both tiers. Without
instrumentation, the only visibility into production behavior is application
logs, which lack timing context and cannot correlate a frontend user action with
a specific API request and its downstream database calls.

Two instrumentation approaches exist:

1. **Vendor-specific SDKs** (e.g. Datadog, New Relic agent): tight integration,
   good out-of-the-box coverage, but lock the application to a single observability
   vendor and add a commercial dependency.
2. **OpenTelemetry (OTel):** a vendor-neutral, CNCF-graduated standard for
   traces, metrics, and logs. Exporters are pluggable; the same SDK can send
   to Jaeger, Tempo, Honeycomb, or any OTLP-compatible backend.

Evidence:
- `apps/api/src/instrumentation.ts`: initializes a `NodeSDK` with an
  `OTLPTraceExporter` (OTLP/HTTP). Auto-instrumentations are enabled with the
  `@opentelemetry/auto-instrumentations-node` package; the `fs` instrumentation
  is explicitly disabled to reduce noise. PII redaction is applied to span
  attributes at the HTTP instrumentation level.
- `apps/web/src/instrumentation.ts`: initializes a `WebTracerProvider` with
  `DocumentLoadInstrumentation`, `FetchInstrumentation`, and
  `UserInteractionInstrumentation`.
- Both files export a `buildResource`/`buildWebResource` function and use
  `SemanticResourceAttributes` for `service.name`, `service.version`, and
  `deployment.environment`.

## Decision

Instrument both the API and the web frontend with OpenTelemetry, exporting
traces via OTLP/HTTP to a configurable collector endpoint.

- **API (`apps/api`):** Node.js auto-instrumentations cover HTTP, database
  drivers, and NestJS internals. The `fs` instrumentation is disabled because
  it generates high-volume, low-signal spans in a server context. Sensitive
  span attributes (authorization headers, client IPs, credential query
  parameters) are redacted before export.
- **Web (`apps/web`):** Browser instrumentations cover document load, fetch
  requests, and user interactions (`DocumentLoadInstrumentation`,
  `FetchInstrumentation`, `UserInteractionInstrumentation`).

Both apps enable tracing only when an environment variable (`OTEL_ENABLED=true`
/ `VITE_OTEL_ENABLED=true`) so telemetry is off by default in development and
test environments.

## Alternatives Considered

- **Vendor-specific APM agents:** simpler initial setup but introduce vendor
  lock-in. Switching backends requires code changes. OTel's pluggable exporter
  model allows backend changes without touching application code.
- **Custom logging only:** provides event records but no timing context or
  cross-service correlation. Reconstructing a request trace from logs is
  laborious and error-prone.
- **No frontend instrumentation:** acceptable for backend-only visibility, but
  frontend-initiated latency (time to first byte, fetch durations, user
  interaction delays) would be invisible.
- **Metrics-only (Prometheus):** complements traces but cannot replace them for
  per-request latency profiling or error root-cause analysis.

## Consequences

- Traces are correlated across API and web using the W3C Trace Context propagation
  built into the OTel SDKs.
- Any OTLP-compatible backend (Jaeger, Grafana Tempo, Honeycomb, etc.) can
  receive the traces without code changes; only the exporter URL changes.
- PII redaction (authorization headers, IPs, credential query params) runs at
  the span processor level, so sensitive data is not exported even if
  auto-instrumentation captures it.
- The `fs` instrumentation exclusion reduces span volume in the API without
  losing meaningful observability.
- Tracing adds a small per-request overhead; this is negligible compared to
  network and database latency.
