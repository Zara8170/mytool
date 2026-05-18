-- CreateTable
CREATE TABLE "harness_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "reportTokenHash" TEXT NOT NULL,
    "reportTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "configSnapshot" JSONB,

    CONSTRAINT "harness_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harness_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "phase" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harness_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "harness_runs_reportTokenHash_key" ON "harness_runs"("reportTokenHash");

-- CreateIndex
CREATE INDEX "harness_runs_projectId_startedAt_idx" ON "harness_runs"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "harness_runs_status_idx" ON "harness_runs"("status");

-- CreateIndex
CREATE INDEX "harness_events_runId_ts_idx" ON "harness_events"("runId", "ts");

-- AddForeignKey
ALTER TABLE "harness_runs" ADD CONSTRAINT "harness_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harness_events" ADD CONSTRAINT "harness_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "harness_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
