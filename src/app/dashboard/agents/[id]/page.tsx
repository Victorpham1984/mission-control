"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentMetrics } from "@/lib/supabase/approval-hooks";
import Header from "@/components/Header";
import AgentProfileEditor from "@/components/agents/AgentProfileEditor";
import AgentMemoryTimeline from "@/components/agents/AgentMemoryTimeline";
import AgentPerformanceDashboard from "@/components/agents/AgentPerformanceDashboard";
import AgentContextPreview from "@/components/agents/AgentContextPreview";
import AgentLearningBadge from "@/components/agents/AgentLearningBadge";

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusColors: Record<string, string> = {
  queued: "text-slate-400",
  "in-progress": "text-blue-400",
  "pending-approval": "text-amber-400",
  completed: "text-green-400",
  failed: "text-red-400",
};

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= Math.round(count) ? "text-amber-400" : "text-slate-600"}`}>★</span>
      ))}
    </span>
  );
}

// Simple bar chart component
function BarChart({ data, maxHeight = 80 }: { data: { label: string; value: number }[]; maxHeight?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: maxHeight + 20 }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-[var(--text-dim)]">{d.value || ""}</span>
          <div className="w-full rounded-t bg-[var(--accent)] transition-all" style={{ height: max > 0 ? (d.value / max) * maxHeight : 0 }} />
          <span className="text-[9px] text-[var(--text-dim)] truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { agent, metrics, loading } = useAgentMetrics(id);
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "performance" | "memory" | "context">("overview");

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">🤖</div>
        </div>
      </div>
    );
  }

  if (!agent || !metrics) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-lg font-bold mb-1">Agent not found</h2>
            <button onClick={() => router.back()} className="text-sm text-[var(--accent)] hover:underline mt-2">← Go back</button>
          </div>
        </div>
      </div>
    );
  }

  const statusDot: Record<string, string> = { online: "bg-green-400", offline: "bg-slate-400", error: "bg-red-400", paused: "bg-slate-400" };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] mb-4">
            <button onClick={() => router.push("/")} className="hover:text-white transition">Dashboard</button>
            <span>/</span>
            <button onClick={() => router.push("/agents")} className="hover:text-white transition">Agents</button>
            <span>/</span>
            <span className="text-white">{agent.name}</span>
          </div>

          {/* Agent header */}
          <div className="bg-[var(--card)] rounded-xl p-5 md:p-6 border border-[var(--border)] mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-3xl">{agent.avatar_emoji || "🤖"}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold">{agent.name}</h1>
                  <div className={`w-2.5 h-2.5 rounded-full ${statusDot[agent.status] || statusDot.offline}`} />
                </div>
                <div className="text-sm text-[var(--text-dim)]">{agent.role}</div>
                {agent.about && <div className="text-xs text-[var(--text-dim)] mt-1">{agent.about}</div>}
              </div>
            </div>
            {metrics.skills.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-4">
                {metrics.skills.map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface)] text-[var(--text-dim)]">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-dim)] mb-1">✅ Completed</div>
              <div className="text-2xl font-bold text-green-400">{metrics.totalCompleted}</div>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-dim)] mb-1">📊 Success Rate</div>
              <div className="text-2xl font-bold text-blue-400">{Math.round(metrics.successRate * 100)}%</div>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-dim)] mb-1">⭐ Avg Rating</div>
              <div className="text-2xl font-bold text-amber-400">{metrics.avgRating || "—"}</div>
              {metrics.avgRating > 0 && <Stars count={metrics.avgRating} />}
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-dim)] mb-1">⏱ Avg Time</div>
              <div className="text-2xl font-bold text-purple-400">{formatDuration(metrics.avgCompletionMs)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Tasks per day chart */}
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Tasks per Day (Last 7 Days)</h3>
              <BarChart data={metrics.tasksPerDay.map(d => ({
                label: new Date(d.date).toLocaleDateString("en", { weekday: "short" }),
                value: d.count,
              }))} />
            </div>

            {/* Rating distribution */}
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Rating Distribution</h3>
              <BarChart data={[1, 2, 3, 4, 5].map(r => ({
                label: `${r}★`,
                value: metrics.ratingDistribution[r],
              }))} />
            </div>
          </div>

          {/* Phase 2B Tabs */}
          <div className="mb-6">
            <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-[var(--border)]">
              {(["overview", "profile", "performance", "memory", "context"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition ${activeTab === tab ? "bg-[var(--card)] text-white font-semibold border border-[var(--border)]" : "text-[var(--text-dim)] hover:text-white"}`}>{tab}</button>
              ))}
            </div>
          </div>

          {activeTab === "profile" && agent && (
            <AgentProfileEditor agentId={id} workspaceId={agent.workspace_id} onSave={() => {}} />
          )}

          {activeTab === "performance" && agent && (
            <AgentPerformanceDashboard workspaceId={agent.workspace_id} />
          )}

          {activeTab === "memory" && agent && (
            <AgentMemoryTimeline workspaceId={agent.workspace_id} agentFilter={id} />
          )}

          {activeTab === "context" && agent && (
            <AgentContextPreview agentId={id} workspaceId={agent.workspace_id} />
          )}

          {activeTab === "overview" && (
            <>
          {/* Recent tasks */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold">Recent Tasks</h3>
            </div>
            {metrics.recentTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-dim)]">No tasks yet</div>
            ) : (
              <div>
                {metrics.recentTasks.map(t => (
                  <div key={t.id}
                    onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--card-hover)] transition cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{t.title}</div>
                      <div className="text-[11px] text-[var(--text-dim)]">{t.type || "task"}</div>
                    </div>
                    <span className={`text-[11px] font-medium ${statusColors[t.status] || "text-slate-400"}`}>{t.status}</span>
                    {t.approval_rating && <Stars count={t.approval_rating} />}
                    <span className="text-[10px] text-[var(--text-dim)]">{formatTime(t.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
