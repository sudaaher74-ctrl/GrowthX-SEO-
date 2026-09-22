-- The profile fields Places serves while the Business Profile APIs are gated.
--
-- Google grants Business Profile API access per Cloud project and gives an
-- unapproved project a quota of zero, so on a deployment waiting for that
-- approval the only readable source for a listing is Places. LocalLocation
-- held name, address, rating and review count, which is why the profile audit
-- could only check four boxes: it had no phone, website, hours or category to
-- look at, whether or not the merchant had filled them in.
--
-- Every column is nullable or empty-by-default. Existing rows get NULL and an
-- empty array, which read as "never asked Places" rather than asserting the
-- merchant has no phone number -- the distinction placesDetailsSyncedAt below
-- exists to record.

ALTER TABLE "LocalLocation" ADD COLUMN "phone" TEXT;
ALTER TABLE "LocalLocation" ADD COLUMN "websiteUri" TEXT;

-- Google's display name for the primary category ("Fruit and vegetable
-- wholesaler"), not the machine type behind it.
ALTER TABLE "LocalLocation" ADD COLUMN "primaryCategory" TEXT;
ALTER TABLE "LocalLocation" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- weekdayDescriptions verbatim, one line per day. Kept as Google wrote them:
-- reducing to open/close times loses split shifts and "Open 24 hours".
ALTER TABLE "LocalLocation" ADD COLUMN "hoursWeekdayText" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- OPERATIONAL, CLOSED_TEMPORARILY or CLOSED_PERMANENTLY, as Places states it.
ALTER TABLE "LocalLocation" ADD COLUMN "businessStatus" TEXT;

-- When the columns above were last read from Places. NULL means nothing has
-- asked yet, which is true of every row that predates this migration and of
-- every listing attached by manual entry, where there is no place to ask about.
ALTER TABLE "LocalLocation" ADD COLUMN "placesDetailsSyncedAt" TIMESTAMP(3);
