-- Closes the gap between migration history and schema.prisma.
--
-- The production database was created with `db push`, which writes no
-- migration history, so five models added after the last migration were
-- never given one: CompetitorSocial, SocialPost, GbpFixProposal,
-- LocalReview and Integration. Any database built from migrations alone
-- came up without them, and content strategy generation queries SocialPost
-- on every call — so it failed against a freshly migrated database while
-- appearing fine on the pushed one.
--
-- The billing tables go the other way: they were dropped from the schema
-- when the billing system was removed, but the init migration still
-- creates them.

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "UsageRecord" DROP CONSTRAINT "UsageRecord_organizationId_fkey";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "UsageRecord";

-- DropEnum
DROP TYPE "PlanType";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "UsageMetric";

-- CreateTable
CREATE TABLE "CompetitorSocial" (
    "id" TEXT NOT NULL,
    "competitorDomainId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorSocial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "isCompetitor" BOOLEAN NOT NULL DEFAULT false,
    "authorHandle" TEXT NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpFixProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" TEXT,
    "proposedValue" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbpFixProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorPhotoUrl" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "time" TEXT NOT NULL,
    "relativeTime" TEXT NOT NULL,
    "aiDraftedReply" TEXT,
    "replyStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSocial_competitorDomainId_platform_key" ON "CompetitorSocial"("competitorDomainId", "platform");

-- CreateIndex
CREATE INDEX "SocialPost_projectId_platform_isCompetitor_idx" ON "SocialPost"("projectId", "platform", "isCompetitor");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_platform_postId_key" ON "SocialPost"("platform", "postId");

-- CreateIndex
CREATE INDEX "GbpFixProposal_projectId_status_idx" ON "GbpFixProposal"("projectId", "status");

-- CreateIndex
CREATE INDEX "LocalReview_projectId_replyStatus_idx" ON "LocalReview"("projectId", "replyStatus");

-- CreateIndex
CREATE INDEX "Integration_projectId_idx" ON "Integration"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_projectId_provider_key" ON "Integration"("projectId", "provider");

-- AddForeignKey
ALTER TABLE "CompetitorSocial" ADD CONSTRAINT "CompetitorSocial_competitorDomainId_fkey" FOREIGN KEY ("competitorDomainId") REFERENCES "CompetitorDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GbpFixProposal" ADD CONSTRAINT "GbpFixProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalReview" ADD CONSTRAINT "LocalReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

