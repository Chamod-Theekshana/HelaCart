# syntax=docker/dockerfile:1
# Pinned to an explicit Node 24 minor/patch on Debian bookworm (slim). Bump
# deliberately, together with .nvmrc / engines, after running the CI checks.
ARG NODE_IMAGE=node:24.19.0-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
# Run as the unprivileged "node" user (uid 1000) provided by the base image.
USER node
EXPOSE 4000
# Liveness only (no database call); orchestrators should probe
# /api/v1/health/ready separately for traffic readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]
