#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ]; then
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

  # Patch Prisma schema to use postgresql provider
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  echo "Using PostgreSQL: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
else
  export DATABASE_URL="file:/data/app.db"
  echo "Using SQLite: /data/app.db"
fi

# Regenerate Prisma client for the chosen provider
npx prisma generate

# Sync schema to database (creates tables if missing)
npx prisma db push --skip-generate --accept-data-loss

echo "Starting application..."
exec node server.js
