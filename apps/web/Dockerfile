# apps/web/Dockerfile
#
# Multi-target build for the React/Vite frontend.
#
# Targets:
#   builder    — install deps + build the SPA bundle (intermediate)
#   dev        — vite dev server on :5173 with HMR (used by docker-compose)
#   production — nginx-unprivileged serving the built static assets on :8080
#                (used by k8s, default target when no --target is given)

# =============================================================================
# Stage 1: builder (also used as base for dev)
# =============================================================================
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests for pnpm resolution
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --filter web... --frozen-lockfile

# Copy web source
COPY apps/web/ ./apps/web/

# Build static SPA → apps/web/dist
RUN pnpm --filter web build

# =============================================================================
# Stage 2a: dev (vite dev server with HMR)
# Used by docker-compose; bind-mounts overlay live source.
# =============================================================================
FROM node:24-alpine AS dev

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --filter web... --frozen-lockfile

COPY apps/web/ ./apps/web/

# Vite needs write access to its temp files in the source directory
RUN chown -R node:node /app/apps/web

USER node
EXPOSE 5173

CMD ["pnpm", "--filter", "web", "dev", "--", "--host", "0.0.0.0"]

# =============================================================================
# Stage 2b: production (nginx serving static assets) — DEFAULT
# =============================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

# Replace stock welcome page with our built SPA
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

EXPOSE 8080
