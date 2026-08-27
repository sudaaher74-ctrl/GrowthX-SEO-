# Base stage for dependencies and Playwright browser binaries
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libasound2 libpangocairo-1.0-0 libxss1 libgtk-3-0 libxshmfence1 libglu1 \
    && rm -rf /var/lib/apt/lists/*

# Development Dependencies stage (used for building)
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# Production Dependencies stage (used for runtime)
FROM base AS prod-deps
COPY package*.json ./
COPY prisma ./prisma/
ENV NODE_ENV=production
RUN npm ci --omit=dev && npx prisma generate

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production runtime stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies instead of all dependencies
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma

# The entrypoint runs scripts/baseline-database.js before migrating, so the
# directory has to exist in the runtime image, not just the build context.
COPY --from=builder --chown=node:node /app/scripts ./scripts

# The Prisma CLI is a devDependency, so `npm ci --omit=dev` leaves it out of the
# runtime image and `npx prisma` would fetch it over the network on every boot.
# It depends only on @prisma/engines, so copying those two is enough to run
# `migrate deploy` at startup offline.
COPY --from=deps --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=node:node /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Crawl snapshots are written here at runtime, by the `node` user set below.
#
# `WORKDIR /app` creates /app as root, and `COPY --chown` only sets ownership on
# what it copies — not on the directory itself — so /app stays root-owned and
# mode 755. StorageService's own recursive mkdir then fails with EACCES, which
# it logs as a warning and continues past, and every snapshot write afterwards
# fails with ENOENT against a directory that was never created.
#
# Creating it here with the right owner is what makes the runtime mkdir a no-op
# rather than a permission error.
RUN mkdir -p /app/storage/snapshots && chown -R node:node /app/storage

# Install Playwright chromium browser for dynamic SPA rendering
# Setting PLAYWRIGHT_BROWSERS_PATH guarantees they are cached securely
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium && chown -R node:node /ms-playwright

USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
