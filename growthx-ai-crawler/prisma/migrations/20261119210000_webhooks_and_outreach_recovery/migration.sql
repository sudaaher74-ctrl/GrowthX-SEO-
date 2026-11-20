CREATE TABLE IF NOT EXISTS "ProjectWebhookConfig" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "slackUrl" TEXT,
  "discordUrl" TEXT,
  "restUrl" TEXT,
  "secretToken" TEXT,
  "events" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWebhookConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectWebhookConfig_projectId_key"
  ON "ProjectWebhookConfig"("projectId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectWebhookConfig_projectId_fkey') THEN
    ALTER TABLE "ProjectWebhookConfig"
      ADD CONSTRAINT "ProjectWebhookConfig_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WebhookDeliveryLog" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "targetHost" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "statusCode" INTEGER,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL,
  "error" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebhookDeliveryLog_projectId_createdAt_idx"
  ON "WebhookDeliveryLog"("projectId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDeliveryLog_projectId_fkey') THEN
    ALTER TABLE "WebhookDeliveryLog"
      ADD CONSTRAINT "WebhookDeliveryLog_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BacklinkOutreachItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'LOST_LINK_RECOVERY',
  "sourceUrl" TEXT NOT NULL,
  "sourceDomain" TEXT NOT NULL,
  "targetUrl" TEXT,
  "contactEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
  "subject" TEXT,
  "emailDraft" TEXT,
  "notes" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "recoveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BacklinkOutreachItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BacklinkOutreachItem_projectId_sourceUrl_key"
  ON "BacklinkOutreachItem"("projectId", "sourceUrl");

CREATE INDEX IF NOT EXISTS "BacklinkOutreachItem_projectId_status_idx"
  ON "BacklinkOutreachItem"("projectId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BacklinkOutreachItem_projectId_fkey') THEN
    ALTER TABLE "BacklinkOutreachItem"
      ADD CONSTRAINT "BacklinkOutreachItem_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
