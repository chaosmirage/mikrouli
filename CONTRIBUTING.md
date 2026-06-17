# Contributing to mikrouli

Thanks for contributing. This guide covers local setup, testing, and the conventions that keep the codebase consistent.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm >=11
- Docker and Docker Compose v2

## Setup

```bash
git clone https://github.com/chaosmirage/mikrouli.git
cd mikrouli
cp .env.example .env
pnpm install
docker compose up -d
```

The full stack comes up on port 8888 (Nginx routes `/api/*` to the API and `/*` to the SPA). Verify it is healthy:

```bash
curl http://localhost:8888/api/health
# -> {"status":"ok"}
```

## Testing

```bash
pnpm test                  # unit tests in both apps (api: Jest, web: Vitest)
pnpm --filter web e2e      # Playwright e2e against the running stack on :8888
```

Playwright's Chromium browser must be installed once per machine:

```bash
pnpm --filter web e2e:install
```

## Spec-first workflow

The API contract is defined in TypeSpec at [`apps/api/spec/main.tsp`](apps/api/spec/main.tsp). For any API change, edit the spec first, then regenerate the committed OpenAPI JSON and TypeScript types:

```bash
pnpm spec:all
```

CI fails on stale generated output -- never hand-edit the generated OpenAPI JSON or TypeScript types; change the spec and regenerate instead.

## Commit format

Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`, `refactor:`). Keep pull requests small and focused: each commit should represent a single coherent concern.

## Internationalization

The web app is localized in three locales -- `en`, `de`, and `el` -- under [`apps/web/src/i18n/locales/`](apps/web/src/i18n/locales/). When adding, removing, or changing a translation key, keep all three locales in parity.
