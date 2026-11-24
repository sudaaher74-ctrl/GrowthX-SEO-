-- Add missing foreign-key indexes on Page/Website/Project child relations so
-- deleting large projects never triggers O(N*M) sequential scans on SetNull/Cascade.
CREATE INDEX IF NOT EXISTS "CatalogProduct_pageId_idx" ON "CatalogProduct"("pageId");
CREATE INDEX IF NOT EXISTS "MarketingSignal_pageId_idx" ON "MarketingSignal"("pageId");
CREATE INDEX IF NOT EXISTS "CompetitorDomain_websiteId_idx" ON "CompetitorDomain"("websiteId");
CREATE INDEX IF NOT EXISTS "OutreachCampaign_projectId_idx" ON "OutreachCampaign"("projectId");
CREATE INDEX IF NOT EXISTS "CustomReport_projectId_idx" ON "CustomReport"("projectId");
CREATE INDEX IF NOT EXISTS "MarketResearchThread_projectId_idx" ON "MarketResearchThread"("projectId");
CREATE INDEX IF NOT EXISTS "MarketOpportunity_projectId_idx" ON "MarketOpportunity"("projectId");
CREATE INDEX IF NOT EXISTS "MarketAction_projectId_idx" ON "MarketAction"("projectId");
CREATE INDEX IF NOT EXISTS "MarketActionOutcome_projectId_idx" ON "MarketActionOutcome"("projectId");
CREATE INDEX IF NOT EXISTS "ContentStrategy_projectId_idx" ON "ContentStrategy"("projectId");
CREATE INDEX IF NOT EXISTS "Campaign_projectId_idx" ON "Campaign"("projectId");
