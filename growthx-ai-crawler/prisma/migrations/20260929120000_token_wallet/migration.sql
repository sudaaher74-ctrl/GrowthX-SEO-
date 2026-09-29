-- Token wallets and their ledger.
--
-- Nothing is backfilled. A wallet is created the first time an organization
-- uses a metered feature, holding that month's allowance, so organizations that
-- predate this migration (and ones made by scripts) start in the same state as
-- a new sign-up without a data step that could fail halfway on a big table.

-- CreateEnum
CREATE TYPE "TokenTransactionKind" AS ENUM ('ALLOWANCE', 'EXPIRY', 'GRANT', 'ADJUSTMENT', 'SPEND', 'REFUND');

-- CreateTable
CREATE TABLE "TokenWallet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "allowanceBalance" INTEGER NOT NULL DEFAULT 0,
    "periodAllowance" INTEGER NOT NULL DEFAULT 0,
    "bonusBalance" INTEGER NOT NULL DEFAULT 0,
    "monthlyAllowance" INTEGER,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "TokenTransactionKind" NOT NULL,
    "action" TEXT NOT NULL,
    "allowanceDelta" INTEGER NOT NULL,
    "bonusDelta" INTEGER NOT NULL,
    "shortfall" INTEGER NOT NULL DEFAULT 0,
    "allowanceAfter" INTEGER NOT NULL,
    "bonusAfter" INTEGER NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "idempotencyKey" TEXT,
    "refundOfId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenWallet_organizationId_key" ON "TokenWallet"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenTransaction_idempotencyKey_key" ON "TokenTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TokenTransaction_organizationId_createdAt_idx" ON "TokenTransaction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenTransaction_organizationId_action_createdAt_idx" ON "TokenTransaction"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TokenTransaction_refundOfId_idx" ON "TokenTransaction"("refundOfId");

-- AddForeignKey
ALTER TABLE "TokenWallet" ADD CONSTRAINT "TokenWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A balance is never negative.
--
-- The service already refuses to overdraw; this is the belt. If a future code
-- path gets the arithmetic wrong, the write fails and is rolled back, instead of
-- a negative number reaching a customer's screen and every later check.
-- (A NULL monthlyAllowance means "the platform default" and passes the check.)
ALTER TABLE "TokenWallet"
  ADD CONSTRAINT "TokenWallet_balances_non_negative"
  CHECK ("allowanceBalance" >= 0 AND "bonusBalance" >= 0 AND "periodAllowance" >= 0 AND "monthlyAllowance" >= 0);

-- The same rule for what the ledger says the balance became after each row,
-- and for the shortfall, which only ever records tokens that were missing.
ALTER TABLE "TokenTransaction"
  ADD CONSTRAINT "TokenTransaction_balances_non_negative"
  CHECK ("allowanceAfter" >= 0 AND "bonusAfter" >= 0 AND "shortfall" >= 0);
