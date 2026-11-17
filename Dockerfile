# syntax=docker/dockerfile:1

# ---- base: same Node version everywhere ----
FROM node:22-alpine AS base
WORKDIR /app

# ---- deps: all dependencies, used to build ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: generate the Prisma client and compile TypeScript ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# `prisma generate` needs a URL to load the config but never connects to it.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build

# ---- prod-deps: only runtime dependencies (no Nest CLI, Jest, ...) ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- production: small final image, runs as a non-root user ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1
# Apply pending migrations, then start. Safe with a single API instance; with several
# instances run `prisma migrate deploy` as a separate release step instead.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
