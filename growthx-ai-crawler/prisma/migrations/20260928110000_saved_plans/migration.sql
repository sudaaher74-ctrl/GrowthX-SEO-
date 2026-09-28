-- Saved plans and action-plan "done" ticks, moved from the browser to the server. Idempotent, like the migrations before it.
CREATE TABLE IF NOT EXISTS "SavedPlan" (
    "projectId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "effortHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliverable" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT,
    "affectedUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "stagedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPlan_pkey" PRIMARY KEY ("projectId", "id")
);

CREATE INDEX IF NOT EXISTS "SavedPlan_projectId_stagedAt_idx" ON "SavedPlan"("projectId", "stagedAt");

CREATE TABLE IF NOT EXISTS "ActionStepDone" (
    "projectId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionStepDone_pkey" PRIMARY KEY ("projectId", "stepKey")
);
