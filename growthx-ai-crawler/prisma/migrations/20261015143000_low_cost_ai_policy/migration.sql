ALTER TABLE "AiUsageRecord"
  ADD COLUMN "budgetCategory" TEXT,
  ADD COLUMN "reservedCostUsd" DOUBLE PRECISION,
  ADD COLUMN "actualCostUsd" DOUBLE PRECISION,
  ADD COLUMN "webSearchCostUsd" DOUBLE PRECISION,
  ADD COLUMN "generationId" TEXT;
CREATE INDEX "AiUsageRecord_budgetCategory_createdAt_idx" ON "AiUsageRecord"("budgetCategory", "createdAt");
CREATE TABLE "AiInternalAnalysisCache" (
  "key" TEXT PRIMARY KEY,
  "completion" JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL
);
ALTER TABLE "AiVisibilitySettings" ALTER COLUMN "promptsQuota" SET DEFAULT 20, ALTER COLUMN "scansPerMonth" SET DEFAULT 3;
