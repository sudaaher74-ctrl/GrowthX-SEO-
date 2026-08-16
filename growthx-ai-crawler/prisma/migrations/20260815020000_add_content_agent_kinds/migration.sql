-- CreateEnum
CREATE TYPE "ContentPieceKind" AS ENUM ('ARTICLE', 'BRIEF', 'GBP_POST', 'FAQ', 'REVIEW_REPLY', 'LANDING_PAGE_OUTLINE', 'SCHEMA_MARKUP');

-- AlterTable
ALTER TABLE "ContentPiece" ADD COLUMN     "kind" "ContentPieceKind" NOT NULL DEFAULT 'ARTICLE',
ADD COLUMN     "sourceEvidenceId" TEXT;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_sourceEvidenceId_fkey" FOREIGN KEY ("sourceEvidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

