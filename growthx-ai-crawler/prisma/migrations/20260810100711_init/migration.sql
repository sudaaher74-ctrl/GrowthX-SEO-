-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('CRAWL_PAGES', 'AI_ANALYSES', 'AUTO_FIXES', 'AI_VISIBILITY_CHECKS', 'STRATEGY_REPORTS');

-- CreateEnum
CREATE TYPE "AiAssistant" AS ENUM ('CHATGPT', 'CLAUDE', 'GEMINI', 'PERPLEXITY', 'AI_OVERVIEWS', 'COPILOT');

-- CreateEnum
CREATE TYPE "SearchIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "SchemaType" AS ENUM ('ORGANIZATION', 'LOCAL_BUSINESS', 'PRODUCT', 'ARTICLE', 'BREADCRUMB', 'FAQ', 'REVIEW', 'VIDEO', 'RECIPE', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FixStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_REVIEW', 'MERGED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutomationRunKind" AS ENUM ('FIXES', 'CONTENT');

-- CreateEnum
CREATE TYPE "ContentPieceStatus" AS ENUM ('PLANNED', 'DRAFTED', 'COMMITTED', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "webhookSecret" TEXT,
    "authCredentials" TEXT,
    "rateLimitDelayMs" INTEGER NOT NULL DEFAULT 500,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 5,
    "maxDepth" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "depthLimit" INTEGER NOT NULL DEFAULT 10,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "contentType" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "robotsMeta" TEXT,
    "h1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "h2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "h3" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "simHash" TEXT,
    "htmlSnapshotUrl" TEXT,
    "screenshotUrl" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AeoMetrics" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "llmCrawlerHits" INTEGER NOT NULL DEFAULT 0,
    "citationProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasStructuredJsonLd" BOOLEAN NOT NULL DEFAULT false,
    "hasSemanticHtml" BOOLEAN NOT NULL DEFAULT false,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AeoMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "pageId" TEXT,
    "issueType" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "affectedUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "aiFixAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "altText" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "isLazy" BOOLEAN NOT NULL DEFAULT false,
    "isMissingAlt" BOOLEAN NOT NULL DEFAULT false,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "isLarge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "isRedirect" BOOLEAN NOT NULL DEFAULT false,
    "isNofollow" BOOLEAN NOT NULL DEFAULT false,
    "anchorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schema" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "schemaType" "SchemaType" NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validationErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "performanceScore" INTEGER,
    "accessibilityScore" INTEGER,
    "bestPracticesScore" INTEGER,
    "seoScore" INTEGER,
    "lcpMs" DOUBLE PRECISION,
    "inpMs" DOUBLE PRECISION,
    "clsScore" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalGraph" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "crawlDepth" INTEGER NOT NULL DEFAULT 0,
    "linkEquityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "seoImpact" TEXT NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "recommendedFixPatch" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "generatedByModel" TEXT,
    "status" "FixStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" TEXT,
    "retainerMonthlyMinor" INTEGER,
    "retainerCurrency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "razorpayCustomerId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "razorpayPlanId" TEXT,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedPrompt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "intent" "SearchIntent",
    "cluster" TEXT,
    "estimatedVolume" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptCheck" (
    "id" TEXT NOT NULL,
    "trackedPromptId" TEXT NOT NULL,
    "assistant" "AiAssistant" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cited" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER,
    "citedUrl" TEXT,
    "competitorsCited" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answerExcerpt" TEXT,
    "model" TEXT,
    "error" TEXT,

    CONSTRAINT "PromptCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "accessTokenEncrypted" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'unknown',
    "contentDir" TEXT,
    "autoMerge" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "AutomationRunKind" NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
    "branch" TEXT,
    "pullRequestUrl" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "filesChanged" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT,
    "status" "ContentPieceStatus" NOT NULL DEFAULT 'PLANNED',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "format" TEXT,
    "targetQuery" TEXT,
    "rationale" TEXT,
    "body" TEXT,
    "metaDescription" TEXT,
    "generatedByModel" TEXT,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "generatedByModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorDomain" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Website_domain_key" ON "Website"("domain");

-- CreateIndex
CREATE INDEX "Website_domain_idx" ON "Website"("domain");

-- CreateIndex
CREATE INDEX "CrawlJob_websiteId_status_idx" ON "CrawlJob"("websiteId", "status");

-- CreateIndex
CREATE INDEX "CrawlJob_createdAt_idx" ON "CrawlJob"("createdAt");

-- CreateIndex
CREATE INDEX "Page_crawlJobId_statusCode_idx" ON "Page"("crawlJobId", "statusCode");

-- CreateIndex
CREATE INDEX "Page_url_idx" ON "Page"("url");

-- CreateIndex
CREATE INDEX "Page_contentHash_idx" ON "Page"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "Page_crawlJobId_url_key" ON "Page"("crawlJobId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "AeoMetrics_pageId_key" ON "AeoMetrics"("pageId");

-- CreateIndex
CREATE INDEX "Issue_crawlJobId_severity_idx" ON "Issue"("crawlJobId", "severity");

-- CreateIndex
CREATE INDEX "Issue_affectedUrl_status_idx" ON "Issue"("affectedUrl", "status");

-- CreateIndex
CREATE INDEX "Issue_issueType_idx" ON "Issue"("issueType");

-- CreateIndex
CREATE INDEX "Image_pageId_idx" ON "Image"("pageId");

-- CreateIndex
CREATE INDEX "Image_isMissingAlt_isBroken_idx" ON "Image"("isMissingAlt", "isBroken");

-- CreateIndex
CREATE INDEX "Link_sourcePageId_linkType_idx" ON "Link"("sourcePageId", "linkType");

-- CreateIndex
CREATE INDEX "Link_targetUrl_idx" ON "Link"("targetUrl");

-- CreateIndex
CREATE INDEX "Schema_pageId_schemaType_idx" ON "Schema"("pageId", "schemaType");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_pageId_key" ON "Performance"("pageId");

-- CreateIndex
CREATE INDEX "Performance_performanceScore_idx" ON "Performance"("performanceScore");

-- CreateIndex
CREATE INDEX "InternalGraph_crawlJobId_sourceUrl_idx" ON "InternalGraph"("crawlJobId", "sourceUrl");

-- CreateIndex
CREATE INDEX "InternalGraph_crawlJobId_targetUrl_idx" ON "InternalGraph"("crawlJobId", "targetUrl");

-- CreateIndex
CREATE INDEX "InternalGraph_crawlJobId_crawlDepth_idx" ON "InternalGraph"("crawlJobId", "crawlDepth");

-- CreateIndex
CREATE UNIQUE INDEX "AIRecommendation_issueId_key" ON "AIRecommendation"("issueId");

-- CreateIndex
CREATE INDEX "AIRecommendation_status_priorityScore_idx" ON "AIRecommendation"("status", "priorityScore");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "UsageRecord_organizationId_periodStart_idx" ON "UsageRecord"("organizationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_organizationId_metric_periodStart_key" ON "UsageRecord"("organizationId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "TrackedPrompt_projectId_isActive_idx" ON "TrackedPrompt"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedPrompt_projectId_text_key" ON "TrackedPrompt"("projectId", "text");

-- CreateIndex
CREATE INDEX "PromptCheck_trackedPromptId_checkedAt_idx" ON "PromptCheck"("trackedPromptId", "checkedAt");

-- CreateIndex
CREATE INDEX "PromptCheck_assistant_checkedAt_idx" ON "PromptCheck"("assistant", "checkedAt");

-- CreateIndex
CREATE INDEX "PromptCheck_checkedAt_idx" ON "PromptCheck"("checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteRepository_projectId_key" ON "SiteRepository"("projectId");

-- CreateIndex
CREATE INDEX "AutomationRun_projectId_startedAt_idx" ON "AutomationRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "ContentPiece_projectId_status_idx" ON "ContentPiece"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPiece_projectId_slug_key" ON "ContentPiece"("projectId", "slug");

-- CreateIndex
CREATE INDEX "StrategyReport_projectId_createdAt_idx" ON "StrategyReport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CompetitorDomain_projectId_idx" ON "CompetitorDomain"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorDomain_projectId_domain_key" ON "CompetitorDomain"("projectId", "domain");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_createdAt_idx" ON "WebhookEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoMetrics" ADD CONSTRAINT "AeoMetrics_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schema" ADD CONSTRAINT "Schema_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalGraph" ADD CONSTRAINT "InternalGraph_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedPrompt" ADD CONSTRAINT "TrackedPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptCheck" ADD CONSTRAINT "PromptCheck_trackedPromptId_fkey" FOREIGN KEY ("trackedPromptId") REFERENCES "TrackedPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRepository" ADD CONSTRAINT "SiteRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "SiteRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyReport" ADD CONSTRAINT "StrategyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorDomain" ADD CONSTRAINT "CompetitorDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
