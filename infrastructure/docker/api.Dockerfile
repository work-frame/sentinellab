# SentinelLab API image. Build from the repository root:
#   docker build -f infrastructure/docker/api.Dockerfile -t sentinellab-api .
FROM node:25-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter "@sentinellab/api..."
RUN pnpm --filter @sentinellab/types build \
 && pnpm --filter @sentinellab/security-engine build \
 && pnpm --filter @sentinellab/api build
# Copy the API with production dependencies only into /out.
RUN pnpm --filter @sentinellab/api deploy --prod --legacy /out \
 && cd /out && node node_modules/prisma/build/index.js generate

FROM node:25-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1
# Run with `docker run --init` (compose sets init: true) so signals reach Node.
# Apply pending migrations (non-destructive), then start the API.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
