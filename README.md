# mikrouli

[![CI](https://github.com/chaosmirage/mikrouli/actions/workflows/ci.yml/badge.svg)](https://github.com/chaosmirage/mikrouli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/static/v1?label=license&message=MIT&color=blue)](LICENSE)

**Live:** https://mikrou.li

URL shortener: registered users turn long URLs into 6-character short links that reliably redirect (302), see per-link click analytics, and can issue/revoke API keys to drive the same shortener via REST without the UI.

Stack: NestJS + React + MUI v5 + PostgreSQL + Redis (primary + replica) + ClickHouse + Nginx, orchestrated via Docker Compose.

## Quick Start

```bash
cp .env.example .env
# edit .env and replace the change-me values with strong secrets
docker compose up -d
# wait ~30s for healthchecks, then:
curl http://localhost:8888/api/health
# -> {"status":"ok"}
```

The full stack (api, web, nginx, postgres, redis-primary, redis-replica, clickhouse) listens on host port 8888 via Nginx. The React SPA is served at `/` and the API is served under `/api/`.

## Features

- 6-character short links with 302 redirects
- Per-link click analytics
- API keys for programmatic access (REST)
- MCP tool endpoint for LLM agents (`POST /api/mcp`)

## Architecture

Three persistence stores serve distinct access patterns: PostgreSQL as the relational source of truth, Redis for the redirect cache, and ClickHouse for click analytics. The API is contract-first, defined in TypeSpec and compiled to OpenAPI with RFC 9457 problem-details errors. Full topology and rationale are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); every major decision is recorded as an Architecture Decision Record in [docs/adr/README.md](docs/adr/README.md).

Headline decisions:

- [ADR-0001](docs/adr/0001-three-store-persistence-split.md) -- three-store persistence: PostgreSQL (relational truth), Redis (redirect cache), ClickHouse (analytics)
- [ADR-0003](docs/adr/0003-redis-cache-aside-redirect-hot-path.md) -- Redis cache-aside on the redirect hot path with read-replica for availability
- [ADR-0004](docs/adr/0004-fire-and-forget-click-recording.md) -- fire-and-forget click recording so redirect latency never waits on analytics
- [ADR-0006](docs/adr/0006-contract-first-api-typespec-openapi-rfc9457.md) -- contract-first API via TypeSpec/OpenAPI with RFC 9457 problem-details errors
- [ADR-0007](docs/adr/0007-dual-auth-jwt-and-hashed-api-keys.md) -- dual authentication: JWT bearer for the SPA, bcrypt-hashed API keys for programmatic clients
- [ADR-0008](docs/adr/0008-k3s-hetzner-default-deny-network-policies.md) -- k3s on Hetzner with zero-trust namespace networking and an explicit EUR 30/month cost ceiling
- [ADR-0013](docs/adr/0013-github-oauth-sign-in-and-account-linking.md) -- GitHub OAuth sign-in with Redis-backed single-use CSRF state, verified-email gating, and find-or-create-or-link account resolution
- [ADR-0014](docs/adr/0014-correlation-id-request-tracing.md) -- end-to-end correlation-ID request tracing via AsyncLocalStorage, nginx pass-through, and OTel span attribute

## Development

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm >=11
- Docker and Docker Compose v2

### Install and run

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

### Development approach

This project is engineered spec-first: the TypeSpec contract is the source of truth for the API, and handlers are written to match the spec, not the other way around. Features are covered by colocated unit tests and end-to-end Playwright tests against the full Docker Compose stack. CI blocks merges on failing tests, lint errors, or build failures. Changes land as small, focused commits with conventional subjects; each commit represents a single coherent concern.

## Contributing

Contributions are welcome -- see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, commit format, and the spec-first workflow. Run `pnpm test` before opening a pull request.

## License

[MIT](LICENSE)
