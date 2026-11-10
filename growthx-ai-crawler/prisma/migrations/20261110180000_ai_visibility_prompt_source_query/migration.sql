-- Additive only: track the source GSC query when a prompt is suggested from Google Search Console
ALTER TABLE "AiVisibilityPrompt" ADD COLUMN "sourceQuery" TEXT;

