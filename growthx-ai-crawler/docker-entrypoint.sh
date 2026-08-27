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

# `set -e` on its own kills the container with no indication of which command
# failed, which reads in the platform log as "Application exited early" and is
# indistinguishable from the API itself crashing. Every step below therefore
# announces itself and, on failure, says so by name before exiting.
run_step() {
  description="$1"
  shift
  echo "$description"
  # Captured through `||` rather than read after `if ! "$@"`: inside that form
  # `$?` is the status of the negation, which is 0 for a failed command — so the
  # guard reported "exit 0" and then exited 0, letting the boot continue past a
  # step that had just failed.
  status=0
  "$@" || status=$?
  if [ "$status" -ne 0 ]; then
    echo "FATAL: boot failed during: $description (exit $status)" >&2
    echo "The API never reached app.listen(), so the platform will report no open ports." >&2
    exit "$status"
  fi
}

# For work that is genuinely optional: a failure is reported and the boot goes on.
run_optional_step() {
  description="$1"
  shift
  if ! "$@"; then
    echo "WARN: $description failed; continuing to start the API." >&2
  fi
}

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
# Migrations run beside the API rather than in front of it.
#
# The platform starts scanning for a bound port as soon as the container is up
# and gives up after a fixed window. Anything slow or stuck ahead of
# `app.listen` — a migration waiting on an advisory lock, a cold database
# endpoint refusing connections — spends that window and the deploy is failed
# for "no open ports", which says nothing about the migration that actually hung.
#
# The trade-off is deliberate and worth naming: for the moments before this
# finishes, the API can serve requests against a schema that is not yet fully
# migrated. That is acceptable here because `migrate deploy` replays only
# migrations absent from _prisma_migrations, so on an up-to-date database it is
# a single fast query and this window is effectively nil. It would not be
# acceptable if the app were shipped with pending destructive migrations.
run_migrations_in_background() {
  status=0
  echo "Checking migration history..."
  node scripts/baseline-database.js || status=$?
  if [ "$status" -ne 0 ]; then
    echo "ERROR: migration history check failed (exit $status). The API is running, but the schema may be stale." >&2
    return
  fi

  echo "Applying database migrations..."
  node node_modules/prisma/build/index.js migrate deploy || status=$?
  if [ "$status" -ne 0 ]; then
    echo "ERROR: 'prisma migrate deploy' failed (exit $status). The API is running against a schema that may be stale;" >&2
    echo "       queries touching a missing table or column will fail until this is resolved." >&2
    return
  fi

  echo "Database migrations applied."

  # Sequenced behind the migrations rather than backgrounded alongside them:
  # they read and write tables and columns the migrations are responsible for
  # creating. Optional in the strict sense — neither may decide whether the API
  # serves traffic.
  run_optional_step "Membership repair" node scripts/repair-membership.js
  run_optional_step "Page type backfill" node scripts/backfill-page-types.js
}

run_migrations_in_background &

# Attaches an account to an organization when REPAIR_ATTACH_EMAIL and
# REPAIR_ATTACH_ORG are set, and does nothing at all otherwise.
#
# It is optional in the strict sense: it must never decide whether the API
# serves traffic. Under `set -e` it previously could — the script prints nothing
# on its no-op path, so anything that made node exit non-zero (a missing file, a
# throw while loading the Prisma client) took the container down leaving
# "Applying database migrations..." as the last line in the log and no reason
# anywhere. An unrepaired membership is a broken workspace; a container that
# will not start is a broken product.
# Nothing above blocks: the API is the container's foreground process and binds
# its port immediately, which is the only thing the platform's health scan is
# waiting for.
echo "Starting API..."
exec node dist/main.js
