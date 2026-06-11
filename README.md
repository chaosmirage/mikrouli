# mikrouli

**Live:** https://mikrou.li

URL shortener: registered users turn long URLs into 6-character short links that reliably redirect (302), see per-link click analytics, and can issue/revoke API keys to drive the same shortener via REST without the UI.

Stack: NestJS + React + MUI v5 + PostgreSQL + Redis (primary + replica) + ClickHouse + Nginx, orchestrated via Docker Compose.

## Architecture & Technical Decisions

The system is built around three persistence stores chosen for distinct access patterns (PostgreSQL as the relational source of truth, Redis for the redirect cache, ClickHouse for click analytics), a contract-first API defined in TypeSpec and compiled to OpenAPI, and a Kubernetes deployment on Hetzner with default-deny network policies under a stated cost ceiling. A full topology walkthrough and the rationale for every major choice are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Each decision is recorded as a lightweight Architecture Decision Record in [docs/adr/README.md](docs/adr/README.md).

Headline decisions:

- [ADR-0001](docs/adr/0001-three-store-persistence-split.md) -- three-store persistence: PostgreSQL (relational truth), Redis (redirect cache), ClickHouse (analytics)
- [ADR-0003](docs/adr/0003-redis-cache-aside-redirect-hot-path.md) -- Redis cache-aside on the redirect hot path with read-replica for availability
- [ADR-0004](docs/adr/0004-fire-and-forget-click-recording.md) -- fire-and-forget click recording so redirect latency never waits on analytics
- [ADR-0006](docs/adr/0006-contract-first-api-typespec-openapi-rfc9457.md) -- contract-first API via TypeSpec/OpenAPI with RFC 9457 problem-details errors
- [ADR-0007](docs/adr/0007-dual-auth-jwt-and-hashed-api-keys.md) -- dual authentication: JWT bearer for the SPA, bcrypt-hashed API keys for programmatic clients
- [ADR-0008](docs/adr/0008-k3s-hetzner-default-deny-network-policies.md) -- k3s on Hetzner with zero-trust namespace networking and an explicit EUR 30/month cost ceiling

## Development Approach

This project is engineered spec-first: the TypeSpec contract is the source of truth for the API; handlers are written to match the spec, not the other way around. Every feature is covered by unit tests (colocated with the source) and validated by end-to-end Playwright tests against the full Docker Compose stack. CI blocks merges on failing tests, lint errors, or build failures. Changes land as small, focused commits with conventional subjects; each commit represents a single coherent concern.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 9+
- Docker and Docker Compose v2

## Quick Start

```bash
cp .env.example .env
# edit .env and replace the change-me values with strong secrets
docker compose up -d
# wait ~30s for healthchecks, then:
curl http://localhost:8888/api/health
# → {"status":"ok"}
```

The full stack (api, web, nginx, postgres, redis-primary, redis-replica, clickhouse) listens on host port 8888 via Nginx. The React SPA is served at `/` and the API is served under `/api/`.

## Development

Install dependencies and run both apps in watch mode:

```bash
pnpm install
pnpm dev
```

Per-app commands:

```bash
pnpm --filter api start:dev      # NestJS in watch mode on :3000
pnpm --filter web dev            # Vite dev server on :5173
```

Build, lint, format:

```bash
pnpm build
pnpm lint
pnpm format
```

## Observability

The API and web app emit OpenTelemetry traces, propagated across the browser/server boundary via the W3C `traceparent` header. Tracing is off by default and enabled via env. The docker-compose stack ships Jaeger all-in-one for local viewing:

```bash
docker compose up -d jaeger
open http://localhost:16686    # pick the mikrouli-api service, then Find Traces
```

Configuration:

| Variable                      | Default                 | Purpose                              |
| ----------------------------- | ----------------------- | ------------------------------------ |
| `OTEL_ENABLED`                | `false`                 | Set `true` to activate the SDK       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Collector OTLP/HTTP base URL         |
| `OTEL_SERVICE_NAME`           | `mikrouli-api`          | `service.name` resource attribute    |

The web frontend uses `VITE_OTEL_ENABLED` and `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` (set at build time) and can point at any OTLP/HTTP collector.

## E2E tests

End-to-end tests use Playwright against the full docker-compose stack. Chromium must be installed once per machine:

```bash
pnpm --filter web e2e:install
```

Run the full suite (requires the stack to be up):

```bash
docker compose up -d
pnpm --filter web e2e
```

For interactive debugging:

```bash
pnpm --filter web e2e:ui
```

The test runner expects the stack at `http://localhost:8888` by default. Override with `E2E_BASE_URL=http://...` if needed.

## Testing

```bash
pnpm test                        # unit tests in both apps
pnpm --filter api test:e2e       # NestJS e2e suite
pnpm --filter web test:e2e       # Playwright
```

## API Endpoints

| Method | Path                 | Auth                | Purpose                    |
| ------ | -------------------- | ------------------- | -------------------------- |
| GET    | `/api/health`        | none                | Liveness probe             |
| POST   | `/api/auth/register` | none                | Create user                |
| POST   | `/api/auth/login`    | none                | Issue JWT pair             |
| POST   | `/api/auth/refresh`  | refresh token       | Rotate access+refresh      |
| GET    | `/api/auth/me`       | Bearer JWT          | Current profile            |
| POST   | `/api/urls`          | Bearer or X-API-Key | Create short link          |
| GET    | `/api/urls`          | Bearer or X-API-Key | List own links             |
| DELETE | `/api/urls/:slug`    | Bearer or X-API-Key | Delete own link            |
| GET    | `/:slug`             | none (public)       | 302 redirect               |
| GET    | `/api/stats/:slug`   | Bearer or X-API-Key | Per-link stats             |
| POST   | `/api/api-keys`      | Bearer JWT          | Issue API key              |
| GET    | `/api/api-keys`      | Bearer JWT          | List own keys              |
| DELETE | `/api/api-keys/:id`  | Bearer JWT          | Revoke key                 |

## Auth Flow

1. **Register**: `POST /api/auth/register` with `{email, password}`. Server bcrypt-hashes the password and returns `{id, email, createdAt}`.
2. **Login**: `POST /api/auth/login` with `{email, password}`. Server returns `{accessToken, refreshToken}`. Access token TTL ≤ 15 minutes.
3. **Authenticated request**: include `Authorization: Bearer <accessToken>` on every protected endpoint.
4. **Refresh**: when the access token nears expiry, call `POST /api/auth/refresh` with `{refreshToken}` to receive a new access + new refresh token (refresh-token rotation).
5. **Logout**: client-side — discard both tokens.

Login with wrong password OR non-existent email returns 401 with the same generic message — no user enumeration.

## API Keys

For programmatic clients, `POST /api/api-keys` issues a key. The plaintext secret is shown **exactly once** in the creation response — store it immediately, the server only persists a hash. Subsequent requests authenticate by sending `X-API-Key: <secret>` instead of (or alongside) a Bearer JWT; an API key has the same scope as the user who issued it, except `/api/auth/*` is rejected.

Revoke with `DELETE /api/api-keys/:id` — the key returns 401 within one request cycle and `last_used_at` stops updating.
