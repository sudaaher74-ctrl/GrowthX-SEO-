-- The Google listing a tracked competitor was matched to.
--
-- Stored on the competitor rather than in LocalLocation, which is one-per-
-- project and describes the customer's own listing. All nullable: null means
-- "not looked up", which is a different statement from a rating of zero.
ALTER TABLE "CompetitorDomain" ADD COLUMN "placeId" TEXT;
ALTER TABLE "CompetitorDomain" ADD COLUMN "localRating" DOUBLE PRECISION;
ALTER TABLE "CompetitorDomain" ADD COLUMN "localReviewCount" INTEGER;
ALTER TABLE "CompetitorDomain" ADD COLUMN "localAddress" TEXT;
ALTER TABLE "CompetitorDomain" ADD COLUMN "localCheckedAt" TIMESTAMP(3);
