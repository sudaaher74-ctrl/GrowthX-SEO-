-- Google data-connector foundation: encrypted token storage, connection
-- status, the resource a customer selected, and an append-only audit trail.
-- All columns are nullable or defaulted; the Integration table is empty in
-- production, and these apply cleanly to a populated one regardless.
-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "googleAccountEmail" TEXT,
ADD COLUMN     "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "nextSyncAt" TIMESTAMP(3),
ADD COLUMN     "selectedResourceId" TEXT,
ADD COLUMN     "selectedResourceName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'NEEDS_SELECTION',
ADD COLUMN     "statusMessage" TEXT;

-- CreateTable
CREATE TABLE "IntegrationAuditEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorUserId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationAuditEvent_projectId_createdAt_idx" ON "IntegrationAuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationAuditEvent_integrationId_createdAt_idx" ON "IntegrationAuditEvent"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- AddForeignKey
ALTER TABLE "IntegrationAuditEvent" ADD CONSTRAINT "IntegrationAuditEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

