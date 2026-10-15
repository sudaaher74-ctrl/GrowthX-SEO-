#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL only: no production connection, published ports or persistent volume.
container="growthx-visibility-migration-test-$$"
root="$(cd "$(dirname "$0")/.." && pwd)"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=visibility-test-only postgres:15-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE "Project" ("id" TEXT PRIMARY KEY);
INSERT INTO "Project" VALUES ('one'), ('two');
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$root/prisma/migrations/20261014183000_ai_visibility_journey/migration.sql"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "AiVisibilityJourney" ("id", "projectId", "updatedAt") VALUES ('first', 'one', NOW());
DO $$ BEGIN
  BEGIN
    INSERT INTO "AiVisibilityJourney" ("id", "projectId", "updatedAt") VALUES ('duplicate', 'one', NOW());
    RAISE EXCEPTION 'Concurrent paid run was not blocked';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
UPDATE "AiVisibilityJourney" SET "status"='READY' WHERE "id"='first';
INSERT INTO "AiVisibilityJourney" ("id", "projectId", "updatedAt") VALUES ('second', 'one', NOW()), ('other-project', 'two', NOW());
DELETE FROM "Project" WHERE "id"='one';
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM "AiVisibilityJourney") <> 1 THEN RAISE EXCEPTION 'Project cascade or tenant isolation failed'; END IF;
END $$;
SQL
echo 'Visibility migration, active-run uniqueness and project deletion checks passed.'
