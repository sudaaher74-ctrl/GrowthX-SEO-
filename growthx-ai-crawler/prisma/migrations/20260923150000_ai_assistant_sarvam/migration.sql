-- Sarvam becomes an assistant whose citation share is measured in its own
-- right. Until now a Sarvam-only install answered checks labelled CHATGPT,
-- CLAUDE and GEMINI, so the dashboard reported a ChatGPT share that ChatGPT
-- was never asked for. Existing rows are left untouched here.
ALTER TYPE "AiAssistant" ADD VALUE IF NOT EXISTS 'SARVAM';
