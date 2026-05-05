# apps/web/Dockerfile
#
# Multi-stage build for the React/Vite frontend.
#
# Stage 1 (builder)    — install deps + build the SPA bundle
# Stage 2 (production) — nginx-unprivileged serving static assets only

# =============================================================================
# Stage 1: builder
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
# Stage 2: production (nginx serving static assets)
# =============================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

# Replace stock welcome page with our built SPA
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

EXPOSE 8080
