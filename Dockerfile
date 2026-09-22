# syntax=docker/dockerfile:1

# ---- build: install all deps, compile, then prune to a production-only bundle ----
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Manifests first so dependency install is cached across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .nvmrc ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @ongem/api...

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter @ongem/api build \
 && pnpm --filter @ongem/api deploy --prod /out

# ---- runtime: minimal image, non-root, no build tools or dev deps ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
