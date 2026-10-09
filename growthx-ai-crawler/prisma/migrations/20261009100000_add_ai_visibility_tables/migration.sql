-- AI visibility tables were present in the Prisma schema but had no migration.
-- Create them additively so existing databases retain all current data.
CREATE TABLE IF NOT EXISTS "AiVisibilityPrompt" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Discovery',
  "journeyStage" TEXT NOT NULL DEFAULT 'DISCOVERY',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiVisibilityPrompt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityPromptVersion" (
  "id" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityPromptVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityPromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiVisibilityPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityScan" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiVisibilityScan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityScan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityScanRun" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "AiVisibilityScanRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityScanRun_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "AiVisibilityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityResponse" (
  "id" TEXT NOT NULL,
  "scanRunId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "surfaceType" TEXT,
  "searchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "promptText" TEXT NOT NULL,
  "promptVersion" INTEGER NOT NULL,
  "latencyMs" INTEGER,
  "rawResponse" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCost" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityResponse_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "AiVisibilityScanRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiVisibilityResponse_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiVisibilityPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityResponseAnalysis" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
  "brandPosition" INTEGER,
  "shortlisted" BOOLEAN NOT NULL DEFAULT false,
  "recommended" BOOLEAN NOT NULL DEFAULT false,
  "finalChoice" BOOLEAN NOT NULL DEFAULT false,
  "sentiment" TEXT,
  "confidence" DOUBLE PRECISION,
  "parsedJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityResponseAnalysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityResponseAnalysis_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AiVisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityCitation" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT,
  "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityCitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityCitation_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AiVisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityBrandMention" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "isCustomer" BOOLEAN NOT NULL,
  "brandName" TEXT NOT NULL,
  "competitorId" TEXT,
  "position" INTEGER,
  "recommended" BOOLEAN NOT NULL DEFAULT false,
  "shortlisted" BOOLEAN NOT NULL DEFAULT false,
  "finalChoice" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityBrandMention_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityBrandMention_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AiVisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityProviderUsage" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityProviderUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityProviderUsage_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AiVisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiVisibilityProviderUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilityMetrics" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "visibilityScore" DOUBLE PRECISION NOT NULL,
  "mentionRate" DOUBLE PRECISION NOT NULL,
  "recommendationRate" DOUBLE PRECISION NOT NULL,
  "shortlistRate" DOUBLE PRECISION NOT NULL,
  "finalChoiceRate" DOUBLE PRECISION NOT NULL,
  "averagePosition" DOUBLE PRECISION,
  "shareOfVoice" JSONB NOT NULL,
  "funnelMetrics" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiVisibilityMetrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityMetrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiVisibilityMetrics_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "AiVisibilityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiVisibilitySettings" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "enabledModels" TEXT[] NOT NULL,
  "useOpenRouter" BOOLEAN NOT NULL DEFAULT false,
  "promptsQuota" INTEGER NOT NULL DEFAULT 10,
  "scansPerMonth" INTEGER NOT NULL DEFAULT 2,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiVisibilitySettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilitySettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiVisibilityResponseAnalysis_responseId_key" ON "AiVisibilityResponseAnalysis"("responseId");
CREATE INDEX IF NOT EXISTS "AiVisibilityPrompt_projectId_isActive_idx" ON "AiVisibilityPrompt"("projectId", "isActive");
CREATE INDEX IF NOT EXISTS "AiVisibilityScan_projectId_cycleId_idx" ON "AiVisibilityScan"("projectId", "cycleId");
CREATE INDEX IF NOT EXISTS "AiVisibilityScan_status_idx" ON "AiVisibilityScan"("status");
CREATE INDEX IF NOT EXISTS "AiVisibilityScanRun_scanId_idx" ON "AiVisibilityScanRun"("scanId");
CREATE INDEX IF NOT EXISTS "AiVisibilityResponse_scanRunId_idx" ON "AiVisibilityResponse"("scanRunId");
CREATE INDEX IF NOT EXISTS "AiVisibilityResponse_promptId_idx" ON "AiVisibilityResponse"("promptId");
CREATE INDEX IF NOT EXISTS "AiVisibilityCitation_responseId_idx" ON "AiVisibilityCitation"("responseId");
CREATE INDEX IF NOT EXISTS "AiVisibilityCitation_domain_idx" ON "AiVisibilityCitation"("domain");
CREATE INDEX IF NOT EXISTS "AiVisibilityBrandMention_responseId_idx" ON "AiVisibilityBrandMention"("responseId");
CREATE INDEX IF NOT EXISTS "AiVisibilityBrandMention_isCustomer_idx" ON "AiVisibilityBrandMention"("isCustomer");
CREATE UNIQUE INDEX IF NOT EXISTS "AiVisibilityProviderUsage_responseId_key" ON "AiVisibilityProviderUsage"("responseId");
CREATE INDEX IF NOT EXISTS "AiVisibilityProviderUsage_projectId_createdAt_idx" ON "AiVisibilityProviderUsage"("projectId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AiVisibilityMetrics_scanId_key" ON "AiVisibilityMetrics"("scanId");
CREATE INDEX IF NOT EXISTS "AiVisibilityMetrics_projectId_idx" ON "AiVisibilityMetrics"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "AiVisibilitySettings_projectId_key" ON "AiVisibilitySettings"("projectId");
