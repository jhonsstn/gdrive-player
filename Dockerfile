FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

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
RUN pnpm exec prisma generate
RUN pnpm run build

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
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Install runtime dependencies (before switching to non-root user)
RUN pnpm install --frozen-lockfile --prod

# Create data directory for SQLite
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
