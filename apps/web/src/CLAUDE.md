# src

## Purpose

Root source directory for the React SPA. Contains the application entry module,
OpenTelemetry instrumentation, and top-level routing and theme setup.

## Key pieces

- `instrumentation.ts` -- OpenTelemetry setup. Initializes the web tracer
  provider, batch exporter, and fetch / document-load / user-interaction
  instrumentations. Restricts `traceparent` header propagation to requests
  whose origin matches the current window origin (or `VITE_API_BASE_URL` in
  non-browser contexts) to prevent trace context from leaking to third-party
  services. Redacts `authorization`, `x-api-key`, and `cookie` headers on
  every span.
- `main.tsx` -- React entry point; mounts `App` into `#root`.
- `App.tsx` -- top-level router, QueryClientProvider, and AuthProvider
  composition.

## How to extend safely

- `propagateTraceHeaderCorsUrls` must remain restricted to the API origin.
  Never pass a wildcard regex (`/.*/`) -- that would forward the `traceparent`
  header to every third-party URL fetched by the app.
- To enable telemetry in an environment, set `VITE_OTEL_ENABLED=true` and
  `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` in the Vite environment. Telemetry is
  disabled by default in development.
- Sensitive headers in `SENSITIVE_HEADERS` are redacted on every span at the
  instrumentation layer. If new sensitive headers are introduced (e.g. a new
  API key header), add them to this constant.
- `instrumentation.ts` runs as a side effect when first imported; `main.tsx`
  imports it before mounting React so the provider is registered before any
  fetch calls are made.
