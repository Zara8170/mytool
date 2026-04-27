import { serverFetch } from "@/lib/server-api";
import type { DashboardSummary } from "@mytool/shared";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function SkillsPage({ params }: PageProps) {
  const { projectId } = await params;
  const summary = await serverFetch<DashboardSummary>(
    `/api/projects/${projectId}/dashboard/summary`,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Skills & Agents</h1>
        <p className="text-muted text-sm">Last 30 days</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-panel border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Skills</h2>
          {summary.topSkills.length === 0 ? (
            <p className="text-muted text-sm">
              No skill calls detected yet. Slash commands and explicit Skill
              tool invocations will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {summary.topSkills.map((s) => (
                <li key={s.skillName}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="font-mono">{s.skillName}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-muted tabular-nums">
                        {s.callCount.toLocaleString()}회
                      </span>
                      {s.failedCount > 0 ? (
                        <span className="text-red-400 text-xs">
                          실패 {(s.failureRate * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">✓</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-bg rounded">
                    <div
                      className="h-full bg-accent rounded"
                      style={{ width: `${(s.callCount / summary.topSkills[0]!.callCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-panel border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Agent types</h2>
          {summary.topAgentTypes.length === 0 ? (
            <p className="text-muted text-sm">No subagent calls yet.</p>
          ) : (
            <BarList
              rows={summary.topAgentTypes.map((a) => ({
                label: a.agentType,
                value: a.callCount,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm mb-0.5">
            <span className="font-mono">{r.label}</span>
            <span className="text-muted tabular-nums">
              {r.value.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 bg-bg rounded">
            <div
              className="h-full bg-accent rounded"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
