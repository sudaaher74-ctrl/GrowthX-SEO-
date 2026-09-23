-- Checks that Sarvam answered while standing in for another assistant were
-- stored as e.g. assistant = CHATGPT, model = 'sarvam-105b (CHATGPT via Sarvam)'.
-- They are Sarvam's answers, so they are moved to SARVAM and the stand-in
-- suffix is dropped. Kept apart from the enum change because Postgres cannot
-- use a new enum value in the transaction that added it.
UPDATE "PromptCheck"
SET "assistant" = 'SARVAM',
    "model" = regexp_replace("model", '\s*\([A-Z_]+ via Sarvam\)$', '')
WHERE "model" LIKE '% via Sarvam)';
