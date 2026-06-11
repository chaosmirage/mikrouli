# src

## Purpose

Application entry point and root module wiring for the NestJS API. Sets up
Express hardening, cookie parsing, global validation, throttling, and the
Swagger UI (non-production only), then starts the HTTP server.

## Key pieces

- `main.ts` -- bootstrap. In order: sets `trust proxy` from `TRUST_PROXY_HOPS`
  (default 1 for the single nginx hop in compose, 2 for k8s with traefik),
  disables the `x-powered-by` header, applies helmet (HSTS deferred to the k8s
  overlay), registers cookie-parser, sets the global `/api` prefix, attaches the
  `ValidationPipe` and `ProblemDetailsFilter`, and conditionally mounts Swagger
  only outside production.
- `app.module.ts` -- `AppModule`. Wires TypeORM (requires `DB_PASS` via
  `getOrThrow`), a global `ThrottlerGuard` with three named buckets (`default`,
  `auth`, `redirect`), and all feature modules. Throttle names are exported as
  `AUTH_THROTTLE_NAME` and `REDIRECT_THROTTLE_NAME` so controllers can reference
  them without string literals.

## How to extend safely

- `trust proxy` must match the number of trusted reverse-proxy hops in the
  deployment. In compose there is one nginx hop (default). In k8s there are two
  (traefik + web-nginx). Miscounting causes `req.ip` to return the wrong
  address; always set `TRUST_PROXY_HOPS` explicitly in the k8s secret rather
  than relying on the default.
- HSTS is intentionally absent from `main.ts` and `nginx.conf`. It belongs
  exclusively in `k8s/overlays/production/hsts-middleware.yaml`.
- Swagger is mounted only when `NODE_ENV` is not `production`. Do not add an
  unconditional call to `mountSwagger`.
- The `ValidationPipe` uses `whitelist: true` and `forbidNonWhitelisted: true`
  so unknown properties on DTOs are rejected. Do not weaken these flags.
- All errors must flow through `ProblemDetailsFilter` to emit RFC 9457
  problem-details bodies. Do not add controllers or exception filters that
  return plain JSON error objects.
