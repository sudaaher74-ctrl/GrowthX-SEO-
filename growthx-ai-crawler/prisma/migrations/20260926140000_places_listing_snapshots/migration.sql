-- Public Google Maps listing snapshots from the Places API (New), which fill
-- the Business Profile tabs while Business Profile API access awaits Google's
-- approval. Idempotent, like the migrations before it, so a database brought
-- up with `db push` does not fail here.

CREATE TABLE IF NOT EXISTS "PlacesListingSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "data" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacesListingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlacesListingSnapshot_projectId_placeId_key" ON "PlacesListingSnapshot"("projectId", "placeId");
CREATE INDEX IF NOT EXISTS "PlacesListingSnapshot_projectId_idx" ON "PlacesListingSnapshot"("projectId");

DO $$ BEGIN
  ALTER TABLE "PlacesListingSnapshot" ADD CONSTRAINT "PlacesListingSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
