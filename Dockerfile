FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy values for build-time env validation (overridden at runtime)
ENV DATABASE_URL="file:./build.db"
ENV AUTH_SECRET="build-placeholder"
ENV AUTH_GOOGLE_ID="build-placeholder"
ENV AUTH_GOOGLE_SECRET="build-placeholder"
ENV ADMIN_EMAILS="build@placeholder"
RUN npx prisma generate
RUN npm run build

# --- Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (owned by nextjs)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs package.json package-lock.json ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /data && chown nextjs:nodejs /data

# Install runtime dependencies as nextjs user (already owned correctly)
USER nextjs
RUN npm ci --omit=dev

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
