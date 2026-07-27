# Base stage for dependencies and Playwright browser binaries
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libasound2 libpangocairo-1.0-0 libxss1 libgtk-3-0 libxshmfence1 libglu1 \
    && rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Install Playwright chromium browser for dynamic SPA rendering
RUN npx playwright install chromium

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
