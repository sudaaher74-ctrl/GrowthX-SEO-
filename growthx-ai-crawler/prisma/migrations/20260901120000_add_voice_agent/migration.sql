-- AlterTable
ALTER TABLE "CompetitorAccount" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "discoverySource" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "matchConfidence" INTEGER,
ADD COLUMN     "verificationStatus" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "CompetitorContent" ADD COLUMN     "confidenceLevel" TEXT,
ADD COLUMN     "dataSourceType" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "hookAnalysis" JSONB,
ADD COLUMN     "ocrText" TEXT,
ADD COLUMN     "scenes" JSONB,
ADD COLUMN     "structureAnalysis" JSONB,
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "transcriptSegments" JSONB,
ADD COLUMN     "whyItWorks" TEXT;

-- AlterTable
ALTER TABLE "CompetitorDomain" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ContentClassification" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "confidence" INTEGER DEFAULT 90,
ADD COLUMN     "contentObjective" TEXT,
ADD COLUMN     "contentPillar" TEXT,
ADD COLUMN     "ctaText" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "funnelStage" TEXT,
ADD COLUMN     "language" TEXT DEFAULT 'en',
ADD COLUMN     "marketingIntent" TEXT,
ADD COLUMN     "searchIntent" TEXT,
ADD COLUMN     "subtopic" TEXT,
ADD COLUMN     "tone" TEXT,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "visualStyle" TEXT;

-- AlterTable
ALTER TABLE "ContentGap" ADD COLUMN     "businessRelevanceScore" INTEGER DEFAULT 85,
ADD COLUMN     "competitorEvidenceScore" INTEGER DEFAULT 85,
ADD COLUMN     "confidenceScore" INTEGER DEFAULT 88,
ADD COLUMN     "contentGapScore" INTEGER DEFAULT 90,
ADD COLUMN     "effortLevel" TEXT DEFAULT 'MEDIUM',
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relatedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "searchOpportunityScore" INTEGER DEFAULT 80,
ADD COLUMN     "suggestedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CompetitorChangeAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorId" TEXT,
    "accountHandle" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metricChange" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CompetitorChangeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorChangeAlert_organizationId_projectId_status_idx" ON "CompetitorChangeAlert"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "CompetitorChangeAlert_projectId_detectedAt_idx" ON "CompetitorChangeAlert"("projectId", "detectedAt");

-- CreateIndex
CREATE INDEX "VoiceSession_userId_createdAt_idx" ON "VoiceSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceSession_orgId_createdAt_idx" ON "VoiceSession"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceMessage_sessionId_createdAt_idx" ON "VoiceMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolCall_sessionId_createdAt_idx" ON "AgentToolCall"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolCall_toolName_status_idx" ON "AgentToolCall"("toolName", "status");

-- AddForeignKey
ALTER TABLE "CompetitorChangeAlert" ADD CONSTRAINT "CompetitorChangeAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

