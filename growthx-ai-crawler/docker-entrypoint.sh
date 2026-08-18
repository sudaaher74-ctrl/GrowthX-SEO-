#!/bin/sh
# Applies any pending schema migrations, then starts the API.
#
# `migrate deploy` only replays migration files that are not yet recorded in
# _prisma_migrations, so on an up-to-date database it is a single fast query —
# unlike `db push`, which introspects and diffs the whole schema on every boot
# and is what previously made the container miss its start deadline.
#
# Prisma takes an advisory lock, so concurrent instances booting together is safe.
set -e

# DATABASE_URL is injected at runtime (on Render, from the linked database), so
# it is present here but absent during the image build — `prisma generate` in
# the Dockerfile must never depend on it. If it is missing at this point the
# Prisma CLI reports a schema validation error pointing at schema.prisma:7,
# which reads as a code problem rather than a missing setting. Say what it is.
if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  echo "The API cannot migrate or serve without a database connection string." >&2
  echo "On Render this comes from the linked Postgres instance (see render.yaml);" >&2
  echo "locally, copy .env.example to .env and fill it in." >&2
  exit 1
fi

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting API..."
exec node dist/main.js
