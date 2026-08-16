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

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting API..."
exec node dist/main.js
