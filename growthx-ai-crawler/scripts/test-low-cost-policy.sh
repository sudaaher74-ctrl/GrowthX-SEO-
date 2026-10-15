#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
name="growthx-low-cost-policy-test-$$"
image=${AI_POLICY_TEST_IMAGE:-growthx-seo-api:latest}
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$name" >/dev/null
docker run --rm -d --name "$name" --network "$name" --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=policy-test-only -e POSTGRES_DB=low_cost_policy_test postgres:15-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$name" psql -U postgres -d low_cost_policy_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE "Organization" ("id" TEXT PRIMARY KEY, "aiMonthlyBudgetUsd" DOUBLE PRECISION);
INSERT INTO "Organization" VALUES ('org', NULL);
CREATE TABLE "AiUsageRecord" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT, "projectId" TEXT,
  "taskType" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
  "inputTokens" INTEGER DEFAULT 0, "outputTokens" INTEGER DEFAULT 0,
  "estimatedCostUsd" DOUBLE PRECISION, "latencyMs" INTEGER NOT NULL,
  "status" TEXT NOT NULL, "error" TEXT, "createdAt" TIMESTAMP DEFAULT NOW()
);
CREATE TABLE "AiVisibilitySettings" ("promptsQuota" INTEGER DEFAULT 10, "scansPerMonth" INTEGER DEFAULT 2);
SQL
docker exec -i "$name" psql -U postgres -d low_cost_policy_test -v ON_ERROR_STOP=1 < "$root/prisma/migrations/20261015143000_low_cost_ai_policy/migration.sql"
docker run --rm --network "$name" --entrypoint node \
  -e "DATABASE_URL=postgresql://postgres:policy-test-only@$name:5432/low_cost_policy_test" \
  -v "$root:/policy-source:ro" \
  -v "$root/scripts/test-low-cost-policy.cjs:/app/scripts/test-low-cost-policy.cjs:ro" \
  "$image" scripts/test-low-cost-policy.cjs
