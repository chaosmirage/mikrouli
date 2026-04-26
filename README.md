# mikrouli

URL shortener: registered users turn long URLs into 6-character short links that reliably redirect (302), see per-link click analytics, and can issue/revoke API keys to drive the same shortener via REST without the UI.

Stack: NestJS + React + MUI v5 + PostgreSQL + Redis (primary + replica) + ClickHouse + Nginx, orchestrated via Docker Compose.

## Prerequisites

- Node.js 20 (see `.nvmrc`)
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

### Local OpenTelemetry tracing

The API ships with an OTel SDK that is disabled by default. To enable it locally,
point it at any OTLP/HTTP collector (Jaeger all-in-one, Grafana Tempo, SigNoz, …):

```bash
# Start a collector first — example with Jaeger all-in-one (Docker):
docker run --rm -p 4318:4318 -p 16686:16686 jaegertracing/all-in-one:latest

# Run the API with tracing enabled
OTEL_ENABLED=true \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
pnpm --filter api start:dev
```

Then open `http://localhost:16686` to explore traces.

| Variable                      | Default                 | Purpose                              |
| ----------------------------- | ----------------------- | ------------------------------------ |
| `OTEL_ENABLED`                | `false`                 | Set `true` to activate the SDK       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Collector OTLP/HTTP base URL         |
| `OTEL_SERVICE_NAME`           | `mikrouli-api`          | `service.name` resource attribute    |
| `SERVICE_VERSION`             | `dev`                   | `service.version` resource attribute |

The web frontend uses `VITE_OTEL_ENABLED` and `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` for
browser traces (set them in `apps/web/.env.local`).

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
| POST   | `/api/auth/register` | none                | Create user           |
| POST   | `/api/auth/login`    | none                | Issue JWT pair        |
| POST   | `/api/auth/refresh`  | refresh token       | Rotate access+refresh |
| GET    | `/api/auth/me`       | Bearer JWT          | Current profile       |
| POST   | `/api/urls`          | Bearer or X-API-Key | Create short link     |
| GET    | `/api/urls`          | Bearer or X-API-Key | List own links        |
| DELETE | `/api/urls/:slug`    | Bearer or X-API-Key | Delete own link       |
| GET    | `/:slug`             | none (public)       | 302 redirect          |
| GET    | `/api/stats/:slug`   | Bearer or X-API-Key | Per-link stats        |
| POST   | `/api/api-keys`      | Bearer JWT          | Issue API key         |
| GET    | `/api/api-keys`      | Bearer JWT          | List own keys         |
| DELETE | `/api/api-keys/:id`  | Bearer JWT          | Revoke key            |


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
