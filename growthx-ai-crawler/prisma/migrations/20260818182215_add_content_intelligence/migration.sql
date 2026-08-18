-- CreateTable
CREATE TABLE "ContentIntelligenceConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "industrySkill" TEXT NOT NULL DEFAULT 'GENERIC',
    "automationLevel" TEXT NOT NULL DEFAULT 'MANUAL',
    "postingFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIntelligenceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT,
    "displayName" TEXT,
    "followerCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorContent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentType" TEXT,
    "publishedAt" TIMESTAMP(3),
    "caption" TEXT,
    "title" TEXT,
    "description" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "contentUrl" TEXT,
    "likesCount" INTEGER,
    "commentsCount" INTEGER,
    "sharesCount" INTEGER,
    "viewsCount" INTEGER,
    "savesCount" INTEGER,
    "engagementAvailable" BOOLEAN NOT NULL DEFAULT false,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentClassification" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentCategory" TEXT,
    "visualFormat" TEXT,
    "detectedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detectedObjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storytellingStyle" TEXT,
    "hookType" TEXT,
    "ctaType" TEXT,
    "creativityScore" DOUBLE PRECISION,
    "classifiedByModel" TEXT,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativePattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyVisualElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storytellingApproach" TEXT,
    "ctaType" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "marketSaturation" INTEGER NOT NULL DEFAULT 0,
    "opportunityScore" INTEGER NOT NULL DEFAULT 50,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativePattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternContentLink" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,

    CONSTRAINT "PatternContentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGap" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "patternId" TEXT,
    "gapType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "competitionLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "opportunityScore" INTEGER NOT NULL DEFAULT 50,
    "recommendedAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStrategy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Content Strategy',
    "content" JSONB NOT NULL,
    "contentPillars" JSONB,
    "platformFrequency" JSONB,
    "campaignIdeas" JSONB,
    "creatorStrategy" TEXT,
    "generatedByModel" TEXT,
    "industrySkill" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendarItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "campaignId" TEXT,
    "gapId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentPillar" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "hook" TEXT,
    "cta" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visualBrief" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalMode" TEXT NOT NULL DEFAULT 'APPROVAL',
    "generatedByModel" TEXT,
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "strategyId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "productFocus" TEXT,
    "targetAudience" TEXT,
    "budget" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "approvalMode" TEXT NOT NULL DEFAULT 'APPROVAL',
    "brief" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "platform" TEXT,
    "profileUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "category" TEXT,
    "industry" TEXT,
    "followerCount" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "averageBudget" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorMatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "scoreBreakdown" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorOutreach" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "campaignId" TEXT,
    "subject" TEXT,
    "messageBody" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "pipelineStage" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "contactedAt" TIMESTAMP(3),
    "responseAt" TIMESTAMP(3),
    "responseText" TEXT,
    "agreedBudget" DOUBLE PRECISION,
    "contractStatus" TEXT,
    "notes" TEXT,
    "approvedToSend" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT,
    "accountName" TEXT,
    "handle" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "calendarItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reach" INTEGER,
    "impressions" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "clicks" INTEGER,
    "views" INTEGER,
    "websiteClicks" INTEGER,
    "leads" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentIntelligenceConfig_projectId_key" ON "ContentIntelligenceConfig"("projectId");

-- CreateIndex
CREATE INDEX "ContentIntelligenceConfig_organizationId_projectId_idx" ON "ContentIntelligenceConfig"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "CompetitorAccount_organizationId_projectId_idx" ON "CompetitorAccount"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "CompetitorAccount_competitorId_idx" ON "CompetitorAccount"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorAccount_projectId_platform_handle_key" ON "CompetitorAccount"("projectId", "platform", "handle");

-- CreateIndex
CREATE INDEX "CompetitorContent_organizationId_projectId_platform_idx" ON "CompetitorContent"("organizationId", "projectId", "platform");

-- CreateIndex
CREATE INDEX "CompetitorContent_accountId_publishedAt_idx" ON "CompetitorContent"("accountId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentClassification_contentId_key" ON "ContentClassification"("contentId");

-- CreateIndex
CREATE INDEX "CreativePattern_organizationId_projectId_opportunityScore_idx" ON "CreativePattern"("organizationId", "projectId", "opportunityScore");

-- CreateIndex
CREATE UNIQUE INDEX "PatternContentLink_patternId_contentId_key" ON "PatternContentLink"("patternId", "contentId");

-- CreateIndex
CREATE INDEX "ContentGap_organizationId_projectId_gapType_idx" ON "ContentGap"("organizationId", "projectId", "gapType");

-- CreateIndex
CREATE INDEX "ContentGap_projectId_status_idx" ON "ContentGap"("projectId", "status");

-- CreateIndex
CREATE INDEX "ContentStrategy_organizationId_projectId_createdAt_idx" ON "ContentStrategy"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_organizationId_projectId_scheduledFor_idx" ON "ContentCalendarItem"("organizationId", "projectId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_projectId_status_idx" ON "ContentCalendarItem"("projectId", "status");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_campaignId_idx" ON "ContentCalendarItem"("campaignId");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_projectId_status_idx" ON "Campaign"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "Creator_organizationId_idx" ON "Creator"("organizationId");

-- CreateIndex
CREATE INDEX "Creator_organizationId_category_idx" ON "Creator"("organizationId", "category");

-- CreateIndex
CREATE INDEX "CreatorMatch_organizationId_projectId_idx" ON "CreatorMatch"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorMatch_campaignId_creatorId_key" ON "CreatorMatch"("campaignId", "creatorId");

-- CreateIndex
CREATE INDEX "CreatorOutreach_organizationId_projectId_pipelineStage_idx" ON "CreatorOutreach"("organizationId", "projectId", "pipelineStage");

-- CreateIndex
CREATE INDEX "CreatorOutreach_creatorId_idx" ON "CreatorOutreach"("creatorId");

-- CreateIndex
CREATE INDEX "SocialAccount_organizationId_projectId_idx" ON "SocialAccount"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_projectId_platform_key" ON "SocialAccount"("projectId", "platform");

-- CreateIndex
CREATE INDEX "SocialMetric_organizationId_projectId_fetchedAt_idx" ON "SocialMetric"("organizationId", "projectId", "fetchedAt");

-- CreateIndex
CREATE INDEX "SocialMetric_calendarItemId_idx" ON "SocialMetric"("calendarItemId");

-- AddForeignKey
ALTER TABLE "ContentIntelligenceConfig" ADD CONSTRAINT "ContentIntelligenceConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorContent" ADD CONSTRAINT "CompetitorContent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CompetitorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentClassification" ADD CONSTRAINT "ContentClassification_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CompetitorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternContentLink" ADD CONSTRAINT "PatternContentLink_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "CreativePattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternContentLink" ADD CONSTRAINT "PatternContentLink_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CompetitorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGap" ADD CONSTRAINT "ContentGap_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "CreativePattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStrategy" ADD CONSTRAINT "ContentStrategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarItem" ADD CONSTRAINT "ContentCalendarItem_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "ContentGap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarItem" ADD CONSTRAINT "ContentCalendarItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "ContentStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorMatch" ADD CONSTRAINT "CreatorMatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorMatch" ADD CONSTRAINT "CreatorMatch_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOutreach" ADD CONSTRAINT "CreatorOutreach_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMetric" ADD CONSTRAINT "SocialMetric_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "ContentCalendarItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
