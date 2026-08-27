/*
  Warnings:

  - You are about to drop the `CompetitorSocial` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `CompetitorDomain` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CompetitorSocial" DROP CONSTRAINT "CompetitorSocial_competitorDomainId_fkey";

-- AlterTable
ALTER TABLE "CompetitorDomain" ADD COLUMN     "confidenceScore" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "nextAnalysisAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
-- Added with a default and then stripped of it below. Prisma's `@updatedAt`
-- creates no database default, so the generated statement was `NOT NULL` with
-- nothing to put in existing rows — which fails outright on a table that is not
-- empty, and CompetitorDomain is not. The default exists only to backfill.
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "CompetitorSocial";

-- CreateIndex
CREATE INDEX "CompetitorDomain_projectId_status_idx" ON "CompetitorDomain"("projectId", "status");

-- AddForeignKey
ALTER TABLE "CompetitorAccount" ADD CONSTRAINT "CompetitorAccount_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "CompetitorDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The default has served its purpose. Dropping it leaves the column exactly as
-- schema.prisma declares it, so `migrate diff` reports no drift afterwards and
-- Prisma remains the only thing writing the timestamp.
ALTER TABLE "CompetitorDomain" ALTER COLUMN "updatedAt" DROP DEFAULT;
