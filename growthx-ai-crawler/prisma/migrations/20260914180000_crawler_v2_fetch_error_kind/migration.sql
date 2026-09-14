-- Records why a fetch produced no origin response.
--
-- statusCode stays a non-null Int and is written as 0 when nothing answered.
-- 0 is not a real HTTP status, so every existing reader that asks `>= 200`,
-- `>= 400` or `=== 200` simply does not match it, rather than counting a
-- network failure on our side as a defect on the customer's site.
ALTER TABLE "Page" ADD COLUMN "fetchErrorKind" TEXT;
