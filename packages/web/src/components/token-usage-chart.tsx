"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsagePoint } from "@mytool/shared";

interface Props {
  series: UsagePoint[];
}

export function TokenUsageChart({ series }: Props) {
  if (series.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted text-sm">
        No usage data yet. Run a Claude Code session to see metrics here.
      </div>
    );
  }

  // 더 보기 좋게 합산 — output 위에 input 쌓기
  const data = series.map((p) => ({
    date: p.date.slice(5), // MM-DD
    input: p.inputTokens,
    output: p.outputTokens,
    cacheRead: p.cacheReadTokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <CartesianGrid stroke="#23282f" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          stroke="#8a939c"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="#8a939c"
          fontSize={11}
          tickLine={false}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          contentStyle={{
            background: "#14181d",
            border: "1px solid #23282f",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v: number) => v.toLocaleString()}
        />
        <Area
          type="monotone"
          dataKey="cacheRead"
          name="Cache read"
          stackId="1"
          stroke="#5eb1ff"
          fill="#5eb1ff"
          fillOpacity={0.15}
        />
        <Area
          type="monotone"
          dataKey="input"
          name="Input"
          stackId="1"
          stroke="#a5d8ff"
          fill="#a5d8ff"
          fillOpacity={0.3}
        />
        <Area
          type="monotone"
          dataKey="output"
          name="Output"
          stackId="1"
          stroke="#ffd166"
          fill="#ffd166"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function tickFormatter(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}
