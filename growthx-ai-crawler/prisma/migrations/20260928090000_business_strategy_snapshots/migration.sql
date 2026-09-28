-- Stored Business -> Marketing Strategy reports. Idempotent, like the migrations before it.
CREATE TABLE IF NOT EXISTS "BusinessStrategySnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessStrategySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessStrategySnapshot_projectId_createdAt_idx" ON "BusinessStrategySnapshot"("projectId", "createdAt");
