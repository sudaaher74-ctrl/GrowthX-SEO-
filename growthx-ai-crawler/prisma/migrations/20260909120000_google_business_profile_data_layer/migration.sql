-- AlterTable
ALTER TABLE "LocalReview" ADD COLUMN     "googleReplyText" TEXT,
ADD COLUMN     "googleReplyUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "googleReviewId" TEXT,
ADD COLUMN     "googleUpdateTime" TIMESTAMP(3),
ADD COLUMN     "locationName" TEXT;

-- CreateTable
CREATE TABLE "GbpLocationProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "accountName" TEXT,
    "title" TEXT,
    "storeCode" TEXT,
    "address" JSONB,
    "addressSummary" TEXT,
    "primaryPhone" TEXT,
    "additionalPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "websiteUri" TEXT,
    "description" TEXT,
    "primaryCategoryId" TEXT,
    "primaryCategoryName" TEXT,
    "additionalCategories" JSONB,
    "regularHours" JSONB,
    "specialHours" JSONB,
    "moreHours" JSONB,
    "serviceArea" JSONB,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "openStatus" TEXT,
    "openingDate" TEXT,
    "placeId" TEXT,
    "mapsUri" TEXT,
    "newReviewUri" TEXT,
    "hasVoiceOfMerchant" BOOLEAN,
    "hasPendingEdits" BOOLEAN,
    "fieldsReturned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbpLocationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "mediaName" TEXT NOT NULL,
    "mediaFormat" TEXT,
    "category" TEXT,
    "googleUrl" TEXT,
    "thumbnailUrl" TEXT,
    "sourceUrl" TEXT,
    "description" TEXT,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "viewCount" INTEGER,
    "attribution" TEXT,
    "createTime" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GbpMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpLocalPost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "postName" TEXT NOT NULL,
    "summary" TEXT,
    "languageCode" TEXT,
    "state" TEXT,
    "topicType" TEXT,
    "searchUrl" TEXT,
    "callToActionType" TEXT,
    "callToActionUrl" TEXT,
    "eventTitle" TEXT,
    "eventStart" TEXT,
    "eventEnd" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createTime" TIMESTAMP(3),
    "updateTime" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GbpLocalPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpServiceItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "serviceTypeId" TEXT,
    "categoryId" TEXT,
    "priceCurrency" TEXT,
    "priceUnits" TEXT,
    "priceNanos" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GbpServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpDailyMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GbpDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GbpSourceStatus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "message" TEXT,
    "httpStatus" INTEGER,
    "lastCount" INTEGER,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbpSourceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GbpLocationProfile_projectId_idx" ON "GbpLocationProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GbpLocationProfile_projectId_locationName_key" ON "GbpLocationProfile"("projectId", "locationName");

-- CreateIndex
CREATE INDEX "GbpMedia_projectId_locationName_idx" ON "GbpMedia"("projectId", "locationName");

-- CreateIndex
CREATE UNIQUE INDEX "GbpMedia_projectId_mediaName_key" ON "GbpMedia"("projectId", "mediaName");

-- CreateIndex
CREATE INDEX "GbpLocalPost_projectId_locationName_idx" ON "GbpLocalPost"("projectId", "locationName");

-- CreateIndex
CREATE UNIQUE INDEX "GbpLocalPost_projectId_postName_key" ON "GbpLocalPost"("projectId", "postName");

-- CreateIndex
CREATE INDEX "GbpServiceItem_projectId_locationName_idx" ON "GbpServiceItem"("projectId", "locationName");

-- CreateIndex
CREATE UNIQUE INDEX "GbpServiceItem_projectId_locationName_serviceKey_key" ON "GbpServiceItem"("projectId", "locationName", "serviceKey");

-- CreateIndex
CREATE INDEX "GbpDailyMetric_projectId_date_idx" ON "GbpDailyMetric"("projectId", "date");

-- CreateIndex
CREATE INDEX "GbpDailyMetric_projectId_metric_date_idx" ON "GbpDailyMetric"("projectId", "metric", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GbpDailyMetric_locationName_date_metric_key" ON "GbpDailyMetric"("locationName", "date", "metric");

-- CreateIndex
CREATE INDEX "GbpSourceStatus_projectId_idx" ON "GbpSourceStatus"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GbpSourceStatus_projectId_locationName_source_key" ON "GbpSourceStatus"("projectId", "locationName", "source");

-- CreateIndex
CREATE INDEX "LocalReview_projectId_locationName_idx" ON "LocalReview"("projectId", "locationName");

-- CreateIndex
CREATE UNIQUE INDEX "LocalReview_projectId_googleReviewId_key" ON "LocalReview"("projectId", "googleReviewId");


-- Deletes the rows written by the retired `google_business` connector.
--
-- That connector stored `tokens.access_token` and `tokens.refresh_token`
-- verbatim in `Integration.accessToken` / `Integration.refreshToken`, columns
-- documented — and used by every other connector — as AES-256-GCM ciphertext.
-- Its code is gone in this change, so nothing can read these rows any more;
-- leaving them would leave live, plaintext Google OAuth tokens in the database
-- with no owner. Business Profile is reconnected through the `business_profile`
-- provider, which encrypts via token-crypto.
DELETE FROM "IntegrationAuditEvent"
WHERE "integrationId" IN (SELECT "id" FROM "Integration" WHERE "provider" = 'google_business');

DELETE FROM "Integration" WHERE "provider" = 'google_business';
