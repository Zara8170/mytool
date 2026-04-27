import { prisma } from "../db.js";

export interface OutlierStats {
  outlierCount: number;
  outlierRatio: number;
  slowestToolName: string | null;
  slowestToolMs: number;
}

/**
 * 세션의 Pre/PostToolUse 페어를 조회해 이상치 통계를 계산한다.
 * 기준: durationMs > median(모든 페어 소요시간) * 10
 */
export async function computeSessionOutlierStats(
  sessionId: string,
): Promise<OutlierStats> {
  const [preEvents, postEvents] = await Promise.all([
    prisma.event.findMany({
      where: { sessionId, hookEventName: "PreToolUse" },
      select: { id: true, toolName: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.event.findMany({
      where: { sessionId, hookEventName: "PostToolUse" },
      select: { timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  if (preEvents.length === 0) {
    return { outlierCount: 0, outlierRatio: 0, slowestToolName: null, slowestToolMs: 0 };
  }

  // Pre-Post 페어링: 각 Pre에 대해 그 이후 첫 Post를 매칭
  const usedPostIndices = new Set<number>();
  const pairs: { toolName: string | null; durationMs: number }[] = [];

  for (const pre of preEvents) {
    const preTime = pre.timestamp.getTime();
    for (let i = 0; i < postEvents.length; i++) {
      if (usedPostIndices.has(i)) continue;
      const postTime = postEvents[i]!.timestamp.getTime();
      if (postTime >= preTime) {
        pairs.push({ toolName: pre.toolName, durationMs: postTime - preTime });
        usedPostIndices.add(i);
        break;
      }
    }
  }

  if (pairs.length === 0) {
    return { outlierCount: 0, outlierRatio: 0, slowestToolName: null, slowestToolMs: 0 };
  }

  const sorted = [...pairs].sort((a, b) => a.durationMs - b.durationMs);
  const midIdx = Math.floor(sorted.length / 2);
  const median = sorted[midIdx]?.durationMs ?? 1;
  const threshold = median * 10;

  const outliers = pairs.filter((p) => p.durationMs > threshold);
  const slowest = sorted[sorted.length - 1];

  return {
    outlierCount: outliers.length,
    outlierRatio: outliers.length / pairs.length,
    slowestToolName: slowest?.toolName ?? null,
    slowestToolMs: slowest?.durationMs ?? 0,
  };
}
