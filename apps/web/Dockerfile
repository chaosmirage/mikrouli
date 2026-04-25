# apps/web/Dockerfile
#
# Development image for the React/Vite application.
# Vite dev server binds to 0.0.0.0 so Nginx can reach it.

FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests for pnpm resolution
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --filter web...

# Copy web source
COPY apps/web/ ./apps/web/

# Vite needs write access to its temp files in the source directory
RUN chown -R node:node /app/apps/web

USER node
EXPOSE 5173

CMD ["pnpm", "--filter", "web", "dev", "--", "--host", "0.0.0.0"]
