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

# Install Playwright chromium browser for dynamic SPA rendering
# Setting PLAYWRIGHT_BROWSERS_PATH guarantees they are cached securely
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium && chown -R node:node /ms-playwright

USER node
EXPOSE 3000
CMD npx prisma migrate deploy && npm run start:prod
