-- CreateTable
CREATE TABLE "SeoImpactRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "url" TEXT,
    "findingType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "windowDays" INTEGER NOT NULL,
    "baseline" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "implementedAt" TIMESTAMP(3),

    CONSTRAINT "SeoImpactRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoImpactRecord_projectId_createdAt_idx" ON "SeoImpactRecord"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoImpactRecord_projectId_url_idx" ON "SeoImpactRecord"("projectId", "url");

-- AddForeignKey
ALTER TABLE "SeoImpactRecord" ADD CONSTRAINT "SeoImpactRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

