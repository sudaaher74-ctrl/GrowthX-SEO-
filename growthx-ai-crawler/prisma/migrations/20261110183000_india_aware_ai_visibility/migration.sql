-- Additive only: support India-aware location targeting and languages (en, hi, hinglish, mr)
ALTER TABLE "AiVisibilitySettings" ADD COLUMN "targetCountry" TEXT NOT NULL DEFAULT 'IN';
ALTER TABLE "AiVisibilitySettings" ADD COLUMN "targetCity" TEXT;
ALTER TABLE "AiVisibilitySettings" ADD COLUMN "targetLanguages" TEXT[] DEFAULT ARRAY['en']::TEXT[];

ALTER TABLE "AiVisibilityPrompt" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "AiVisibilityPrompt" ADD COLUMN "parentPromptId" TEXT;

ALTER TABLE "AiVisibilityResponse" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "AiVisibilityResponse" ADD COLUMN "location" TEXT;
ALTER TABLE "AiVisibilityResponse" ADD COLUMN "locationSupported" BOOLEAN NOT NULL DEFAULT true;
