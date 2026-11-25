# syntax=docker/dockerfile:1

# 1. Install every dependency (including dev) for the build. The Prisma schema
#    is copied first because `postinstall` runs `prisma generate`.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# 2. Compile TypeScript. Tests and vitest config are excluded by
#    tsconfig.build.json, so the image never contains them.
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# 3. Runtime: production dependencies only, non-root, no toolchain.
#    `prisma` is a production dependency so migrations can run here.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

# Uses Node's own fetch, so the image needs no curl or wget.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# `migrate deploy` is idempotent; it applies pending migrations, then serves.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main/server.js"]
