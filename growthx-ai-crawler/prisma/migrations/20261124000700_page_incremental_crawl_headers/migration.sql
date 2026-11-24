-- Store HTTP ETag and Last-Modified validators on Page to support incremental
-- 304 Not Modified delta re-crawls without re-downloading or re-rendering unchanged pages.
ALTER TABLE "Page"
  ADD COLUMN IF NOT EXISTS "httpEtag" TEXT,
  ADD COLUMN IF NOT EXISTS "httpLastModified" TEXT;
