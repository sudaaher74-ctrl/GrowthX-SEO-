-- Street address and phone number for a project's business.
--
-- The onboarding wizard has always asked for both and had nowhere to put them:
-- it sent only businessName and industry, so everything the operator typed
-- about where the business is and how to reach it was discarded at the end of
-- step 3. They belong with the city/state/country already on this table, which
-- is the row that answers "what is this business" for the rest of the product.
--
-- Nullable: neither is detectable from a website with any reliability, so an
-- automatically detected profile leaves them empty rather than guessing.
ALTER TABLE "ProjectBusinessProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "ProjectBusinessProfile" ADD COLUMN "phone" TEXT;
