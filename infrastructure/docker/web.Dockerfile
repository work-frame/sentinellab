# SentinelLab web image. Build from the repository root:
#   docker build -f infrastructure/docker/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 -t sentinellab-web .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# The browser calls the API at this URL, so it is baked into the client bundle.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter "@sentinellab/web..."
RUN pnpm --filter "@sentinellab/web..." run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
# Run with `docker run --init` (compose sets init: true) so signals reach Node.
CMD ["node", "apps/web/server.js"]
