# mikrouli

mikrouli is a URL shortener with click analytics. The API is NestJS (TypeScript)
over PostgreSQL, Redis, and ClickHouse; the web app is React 18 with Vite and MUI.
The API contract is defined contract-first in TypeSpec and generates the committed
OpenAPI types. It runs locally on Docker Compose and in production on k3s (Hetzner)
with end-to-end OpenTelemetry tracing. The repository is a pnpm workspace monorepo.

## Commands

```sh
pnpm install                     # install workspace deps (Node >= 24, pnpm >= 11)
cp .env.example .env             # then set DB_PASS, JWT_SECRET, JWT_REFRESH_SECRET

pnpm build                       # build all workspaces (pnpm -r build)
pnpm test                        # unit tests (api: Jest *.spec.ts; web: Vitest *.test.tsx)
pnpm lint                        # eslint, zero warnings (--max-warnings 0)
pnpm format                      # prettier --write .

docker compose up                # prod-shaped stack; nginx on :8888 routes /api and the SPA
docker compose --profile dev up  # dev stack: Vite HMR on :5173, Jaeger UI on :16686
pnpm --filter api migration:run  # apply database migrations (run on first start)
pnpm --filter web e2e            # Playwright e2e (the stack must be up on :8888)

pnpm spec:all                    # recompile TypeSpec -> OpenAPI -> TypeScript types

pnpm --filter web storybook      # start component workbench on :6006 (no backend needed)
pnpm --filter web build-storybook  # build static component catalog to apps/web/storybook-static
```

## Manual setup (one-time, GitHub Pages)

Enable GitHub Pages in repository Settings -> Pages with Source set to
"GitHub Actions". This is required for `.github/workflows/storybook-pages.yml`
to publish the static catalog on every push to `main`. The workflow will fail at
the deploy step until this setting is enabled.

## Architecture

Two request paths share the data stores. The redirect hot path resolves a slug from
a Redis cache (falling back to PostgreSQL) and records the click fire-and-forget into
ClickHouse; the dashboard path reads relational data from PostgreSQL and aggregates
analytics from ClickHouse. nginx terminates HTTP and routes `/api/*` to the NestJS API
and `/*` to the React SPA. The API contract lives in `apps/api/spec/main.tsp`, which
generates the committed OpenAPI JSON and TypeScript types both apps consume; errors are
RFC 9457 problem-details. LLM agents can create short links over the Model Context
Protocol at `POST /api/mcp` (`apps/api/src/mcp`), an API-key-authenticated, stateless
Streamable-HTTP server that reuses the REST link-creation validation and error contract.
Full design and rationale: `docs/ARCHITECTURE.md` and `docs/adr/`.

```
apps/api    NestJS app + TypeSpec spec (apps/api/spec/main.tsp)
apps/web    React/Vite SPA + Playwright e2e (apps/web/e2e)
clickhouse  ClickHouse user configuration
k8s         Kustomize base + overlays/production
nginx       prod and dev reverse-proxy configs
```

## Conventions

- Name API files in kebab-case with the NestJS role suffix: `links.controller.ts`,
  `links.service.ts`, `links.module.ts`.
- Name React components in PascalCase: `DashboardPage.tsx`.
- Colocate unit tests beside the source: `*.spec.ts` (api, Jest), `*.test.tsx` / `*.test.ts` (web, Vitest).
- Edit `apps/api/spec/main.tsp` first for any API change, then run `pnpm spec:all`;
  CI fails on stale generated output.
- Keep the three locales (`en`, `de`, `el`) under `apps/web/src/i18n/locales/` in parity:
  add or remove every key in all three.
- Tag deployment images with the git SHA via the `GITSHA-PLACEHOLDER` in `k8s/overlays/production/`.

## Constraints

- Never return plain JSON error bodies; emit RFC 9457 problem-details through
  `apps/api/src/common/problem-details.filter.ts` instead.
- Never weaken the root `tsconfig.json` flags (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`); fix the types instead.
- Never commit `.env`, `.mcp.json`, or other local tool config; keep them gitignored
  and rely on `.env.example` instead.
- Never tag deployment images `:latest`; pin them to the git SHA instead.
- Never hand-edit the generated OpenAPI or TypeScript output; change `main.tsp`
  and regenerate instead.
