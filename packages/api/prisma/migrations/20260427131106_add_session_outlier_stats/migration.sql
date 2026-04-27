-- Add outlier stats columns to claude_sessions
ALTER TABLE "claude_sessions"
  ADD COLUMN IF NOT EXISTS "outlierCount"    INTEGER,
  ADD COLUMN IF NOT EXISTS "outlierRatio"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "slowestToolName" TEXT,
  ADD COLUMN IF NOT EXISTS "slowestToolMs"   INTEGER;
