-- Lets a customer's own social account be recorded as discovered, not connected.
--
-- SocialAccount only ever described an OAuth connection, so an account found
-- on the customer's own website had nowhere to go and was not recorded at all.
-- These columns keep the distinction explicit: a row with discoverySource set
-- and status DISCONNECTED is a profile we found published on their site, which
-- is a different claim from a connected account.
ALTER TABLE "SocialAccount" ADD COLUMN "profileUrl" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "discoverySource" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "discoveredAt" TIMESTAMP(3);
