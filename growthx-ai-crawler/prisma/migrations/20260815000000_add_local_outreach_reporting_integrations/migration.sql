-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "linkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachContact" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastContact" TIMESTAMP(3),

    CONSTRAINT "OutreachContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalLocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "citationsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "recipients" TEXT[],
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customDomain" TEXT,
    "logoUrl" TEXT,
    "themeColor" TEXT DEFAULT '#2563eb',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIntelligence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sentimentSummary" TEXT,
    "trendingTopics" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uptimeStatus" TEXT NOT NULL DEFAULT 'UP',
    "uptimePercentage" DOUBLE PRECISION NOT NULL DEFAULT 99.99,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 250,
    "lastDowntimeAt" TIMESTAMP(3),
    "sslStatus" TEXT NOT NULL DEFAULT 'VALID',
    "sslExpiresAt" TIMESTAMP(3),
    "performanceScore" INTEGER NOT NULL DEFAULT 90,
    "mobileScore" INTEGER NOT NULL DEFAULT 85,
    "coreWebVitalsStatus" TEXT NOT NULL DEFAULT 'PASSING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gaConnected" BOOLEAN NOT NULL DEFAULT false,
    "gscConnected" BOOLEAN NOT NULL DEFAULT false,
    "gaPropertyId" TEXT,
    "gscPropertyId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hubspotConnected" BOOLEAN NOT NULL DEFAULT false,
    "hubspotPortalId" TEXT,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalRanking" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "previousPos" INTEGER,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalLocation_projectId_key" ON "LocalLocation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalConfig_projectId_key" ON "ClientPortalConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIntelligence_projectId_key" ON "MarketIntelligence"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringConfig_projectId_key" ON "MonitoringConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_projectId_key" ON "IntegrationConfig"("projectId");

-- CreateIndex
CREATE INDEX "LocalRanking_locationId_idx" ON "LocalRanking"("locationId");

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalLocation" ADD CONSTRAINT "LocalLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomReport" ADD CONSTRAINT "CustomReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalConfig" ADD CONSTRAINT "ClientPortalConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketIntelligence" ADD CONSTRAINT "MarketIntelligence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringConfig" ADD CONSTRAINT "MonitoringConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalRanking" ADD CONSTRAINT "LocalRanking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocalLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

