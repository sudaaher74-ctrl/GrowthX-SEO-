-- Additive only: one new table, no changes to existing data.
CREATE TABLE "RecommendationAnalysis" (
  "id" TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL, "analysisVersion" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL, "analysis" JSONB NOT NULL,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationAnalysis_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BacklinkSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecommendationAnalysis_sourceId_key" ON "RecommendationAnalysis"("sourceId");
CREATE INDEX "RecommendationAnalysis_analyzedAt_idx" ON "RecommendationAnalysis"("analyzedAt");
