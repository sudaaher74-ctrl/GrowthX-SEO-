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

# Prisma runs migrations over `directUrl`, which needs a direct connection:
# session state and advisory locks do not survive a connection pooler. On Neon
# that is the same URL with `-pooler` removed from the host. Deriving it here
# means a deployment only has to set DATABASE_URL — and because a declared
# `directUrl` is required rather than optional, leaving it unset would
# otherwise fail schema validation and stop the container from booting at all.
# On a database with no pooler in its host the substitution matches nothing and
# DIRECT_URL simply equals DATABASE_URL, which is correct there.
if [ -z "$DIRECT_URL" ]; then
  DIRECT_URL=$(printf '%s' "$DATABASE_URL" | sed 's/-pooler\./\./')
  export DIRECT_URL
  echo "DIRECT_URL derived from DATABASE_URL for migrations."
fi

# The production schema was created with `db push`, which writes no migration
# history, so `migrate deploy` finds tables it cannot account for and stops with
# P3005 rather than replay CREATE TABLE over live data. This records the
# migrations the database demonstrably already contains, having checked their
# tables and enum types are really there, and leaves the rest to be applied
# normally below. It is a no-op once history exists, and on an empty database.
echo "Checking migration history..."
node scripts/baseline-database.js

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

# Attaches an account to an organization when REPAIR_ATTACH_EMAIL and
# REPAIR_ATTACH_ORG are set, and does nothing at all otherwise. Free-plan
# services have no shell, so this is the only way in to a repair that
# otherwise needs one. It never fails the boot.
node scripts/repair-membership.js

echo "Starting API..."
exec node dist/main.js
