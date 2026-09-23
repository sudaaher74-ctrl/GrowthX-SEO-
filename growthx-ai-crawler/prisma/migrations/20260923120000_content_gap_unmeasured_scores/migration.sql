-- Content-gap sub-scores are only real when something measured them.
--
-- These columns defaulted to 85/80/85/90/88 (and effort to MEDIUM) while the
-- only writer, gap analysis, never sets them, so every new gap carried the
-- same breakdown and it was shown to customers as if each one had been
-- scored. Without the defaults a new gap stores null, which renders as "not
-- measured" — what it always was. Existing rows are left untouched here.
ALTER TABLE "ContentGap" ALTER COLUMN "businessRelevanceScore" DROP DEFAULT;
ALTER TABLE "ContentGap" ALTER COLUMN "searchOpportunityScore" DROP DEFAULT;
ALTER TABLE "ContentGap" ALTER COLUMN "competitorEvidenceScore" DROP DEFAULT;
ALTER TABLE "ContentGap" ALTER COLUMN "contentGapScore" DROP DEFAULT;
ALTER TABLE "ContentGap" ALTER COLUMN "confidenceScore" DROP DEFAULT;
ALTER TABLE "ContentGap" ALTER COLUMN "effortLevel" DROP DEFAULT;

-- Same defect on content classification: neither classifier reports a
-- confidence, so every row showed a confidence of 90 nobody computed.
ALTER TABLE "ContentClassification" ALTER COLUMN "confidence" DROP DEFAULT;
