-- CreateEnum
CREATE TYPE "ChangeClass" AS ENUM ('SCHEMA_MARKUP', 'FAQ_BLOCK', 'ENTITY_DISAMBIGUATION', 'HEADING_STRUCTURE', 'COMPARISON_TABLE', 'AUTHOR_CREDENTIALS', 'INTERNAL_LINKS', 'FRESHNESS_UPDATE', 'CITED_STATISTIC', 'CANONICAL_CONSOLIDATION', 'METADATA', 'MEDIA_ALT', 'PAGE_SPEED', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionArm" AS ENUM ('TREAT', 'HOLD');

-- AlterTable: give every citation observation a place it was asked from.
ALTER TABLE "PromptCheck" ADD COLUMN "locationId" TEXT;
ALTER TABLE "PromptCheck" ADD COLUMN "metroId" TEXT;
ALTER TABLE "PromptCheck" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "PromptCheck" ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "PromptCheck_metroId_checkedAt_idx" ON "PromptCheck"("metroId", "checkedAt");

-- CreateIndex
CREATE INDEX "PromptCheck_locationId_checkedAt_idx" ON "PromptCheck"("locationId", "checkedAt");

-- CreateTable
CREATE TABLE "FixIntervention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "changeClass" "ChangeClass" NOT NULL,
    "arm" "InterventionArm" NOT NULL DEFAULT 'TREAT',
    "beforePageId" TEXT,
    "afterPageId" TEXT,
    "automationRunId" TEXT,
    "pullRequestUrl" TEXT,
    "mergedSha" TEXT,
    "summary" TEXT,
    "shippedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionOutcome" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "assistant" "AiAssistant",
    "windowDays" INTEGER NOT NULL,
    "preCitationRate" DOUBLE PRECISION NOT NULL,
    "postCitationRate" DOUBLE PRECISION NOT NULL,
    "preSampleSize" INTEGER NOT NULL,
    "postSampleSize" INTEGER NOT NULL,
    "controlPreRate" DOUBLE PRECISION,
    "controlPostRate" DOUBLE PRECISION,
    "controlSampleSize" INTEGER,
    "lift" DOUBLE PRECISION,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixIntervention_projectId_changeClass_shippedAt_idx" ON "FixIntervention"("projectId", "changeClass", "shippedAt");

-- CreateIndex
CREATE INDEX "FixIntervention_projectId_arm_idx" ON "FixIntervention"("projectId", "arm");

-- CreateIndex
CREATE INDEX "FixIntervention_url_idx" ON "FixIntervention"("url");

-- CreateIndex
CREATE INDEX "InterventionOutcome_interventionId_idx" ON "InterventionOutcome"("interventionId");

-- CreateIndex
CREATE INDEX "InterventionOutcome_interventionId_windowDays_idx" ON "InterventionOutcome"("interventionId", "windowDays");

-- AddForeignKey
ALTER TABLE "InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "FixIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
