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
            <BarList
              rows={summary.topSkills.map((s) => ({
                label: s.skillName,
                value: s.callCount,
              }))}
            />
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
