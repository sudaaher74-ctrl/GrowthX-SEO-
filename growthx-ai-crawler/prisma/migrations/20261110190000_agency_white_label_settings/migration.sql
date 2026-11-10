-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "whiteLabelEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "agencyName" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "brandColor" TEXT,
ADD COLUMN "contactLine" TEXT,
ADD COLUMN "footerText" TEXT;
