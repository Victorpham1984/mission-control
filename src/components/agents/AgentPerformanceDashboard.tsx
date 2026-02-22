"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { calculateTrend } from "@/lib/utils/format";

interface PerformanceData {
  totalTasks: number;
  avgRating: number;
  avgQualityScore: number;
  successRate: number;
  ratingDistribution: Record<number, number>;
  qualityTrend: Array<{ date: string; avgRating: number; avgQuality: number }>;
  topExamples: Array<{ taskId: string; description: string; outputSnippet: string; rating: number; qualityScore: number; createdAt: string }>;
}

interface AgentPerformanceDashboardProps {
  workspaceId: string;
}

export default function AgentPerformanceDashboard({ workspaceId }: AgentPerformanceDashboardProps) {
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [period, setPeriod] = useState("30d");

  const { data: agents = [] } = useQuery<{ id: string; name: string; avatar_emoji: string }[]>({
    queryKey: ["agents-list", workspaceId],
    queryFn: () => fetch(`/api/v1/agents?workspace_id=${workspaceId}`).then(r => r.json()).then(d => d.agents || d || []),
  });

  const { data: performance, isLoading } = useQuery<PerformanceData>({
    queryKey: ["agent-performance", selectedAgent, period, workspaceId],
    queryFn: () => {
      const params = new URLSearchParams({ workspace_id: workspaceId, period });
      if (selectedAgent !== "all") params.append("agent_id", selectedAgent);
      return fetch(`/api/v1/agents/performance?${params}`).then(r => r.json());
    },
  });

  const trend = calculateTrend(performance?.qualityTrend || []);

  const handleExportCSV = () => {
    if (!performance?.qualityTrend) return;
    const csv = ["Date,Avg Rating,Avg Quality", ...performance.qualityTrend.map(d => `${d.date},${d.avgRating},${d.avgQuality}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agent-performance.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const distData = performance?.ratingDistribution
    ? [5, 4, 3, 2, 1].map(r => ({ rating: `${r}⭐`, count: performance.ratingDistribution[r] || 0 }))
    : [];

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <div className="p-6 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Agent Performance</h2>
        <div className="flex flex-wrap gap-2">
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="all">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.avatar_emoji || "🤖"} {a.name}</option>)}
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button onClick={handleExportCSV} className="px-3 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition flex items-center gap-1">
            📥 Export
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[var(--surface)] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-dim)] mb-1">Total Tasks</div>
                <div className="text-2xl font-bold">{performance?.totalTasks || 0}</div>
              </div>
              <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-dim)] mb-1">Avg Rating</div>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {performance?.avgRating?.toFixed(1) || "—"} <span className="text-yellow-500">⭐</span>
                </div>
              </div>
              <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-dim)] mb-1">Avg Quality</div>
                <div className="text-2xl font-bold">{performance?.avgQualityScore?.toFixed(1) || "—"}<span className="text-sm font-normal text-[var(--text-dim)]">/10</span></div>
              </div>
              <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-dim)] mb-1">Success Rate</div>
                <div className={`text-2xl font-bold ${(performance?.successRate || 0) >= 80 ? "text-[var(--green)]" : (performance?.successRate || 0) >= 60 ? "text-[var(--orange)]" : "text-[var(--red)]"}`}>
                  {performance?.successRate || 0}%
                </div>
              </div>
            </div>

            {/* Trend Line Chart */}
            {performance?.qualityTrend && performance.qualityTrend.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Quality Trend</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={performance.qualityTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickFormatter={d => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                    <YAxis domain={[0, 10]} tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
                    <Line type="monotone" dataKey="avgRating" stroke="#e2a04a" strokeWidth={2} dot={false} name="Rating" />
                    <Line type="monotone" dataKey="avgQuality" stroke="#60a5fa" strokeWidth={2} dot={false} name="Quality" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Rating Distribution */}
            {distData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Rating Distribution</h3>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = performance?.ratingDistribution?.[rating] || 0;
                    const total = performance?.totalTasks || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-sm w-8 shrink-0">{rating}⭐</span>
                        <div className="flex-1 bg-[var(--surface)] rounded-full h-5 overflow-hidden">
                          <div className="bg-yellow-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[var(--text-dim)] w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Examples */}
            {performance?.topExamples && performance.topExamples.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Top Examples</h3>
                <div className="space-y-2">
                  {performance.topExamples.map(ex => (
                    <div key={ex.taskId} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{ex.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">{ex.rating}⭐</span>
                          {ex.qualityScore > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{ex.qualityScore}/10</span>}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-dim)] line-clamp-2">{ex.outputSnippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
