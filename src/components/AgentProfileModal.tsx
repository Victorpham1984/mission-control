"use client";
import { type Agent, type Task, colNames, colColors } from "@/lib/data";
import type { Agent as DbAgent } from "@/lib/supabase/types";

const badgeLabel: Record<string, string> = { lead: "Lead", spc: "Specialist", int: "Integrator" };
const badgeClass: Record<string, string> = { lead: "bg-amber-500 text-black", spc: "bg-purple-500 text-white", int: "bg-blue-500 text-white" };
const statusLabel: Record<string, string> = { working: "🟢 Working", idle: "⚪ Idle", error: "🔴 Error" };
const taskStatusColors: Record<string, string> = { pending: "#94a3b8", running: "#60a5fa", completed: "#4ade80", failed: "#f87171" };
const taskStatusLabels: Record<string, string> = { pending: "Pending", running: "Running", completed: "Completed", failed: "Failed" };

type Props = {
  agent: Agent;
  dbAgent?: DbAgent;
  tasks: Task[];
  onClose: () => void;
  onOpenChat: () => void;
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentProfileModal({ agent, dbAgent, tasks, onClose, onOpenChat }: Props) {
  const allTasks = tasks.filter(t => t.agent === agent.id);
  const activeTasks = allTasks.filter(t => t.status !== "done");
  const config = (dbAgent?.config || {}) as Record<string, unknown>;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-t-2xl md:rounded-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-[var(--border)] text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-white text-xl">×</button>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ background: agent.color + "22", color: agent.color }}>{agent.emoji}</div>
          <h2 className="text-lg font-bold">{agent.name}</h2>
          <p className="text-sm text-[var(--text-dim)]">{agent.role}</p>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeClass[agent.badge]}`}>{badgeLabel[agent.badge]}</span>
            <span className="text-xs text-[var(--text-dim)]">{statusLabel[agent.status]}</span>
            {dbAgent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--card)] text-[var(--text-dim)]">{dbAgent.type}</span>}
          </div>
        </div>

        {/* Agent Details */}
        {dbAgent && (
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Last Seen</div>
                <div className="text-[13px]">{formatLastSeen(dbAgent.last_seen_at)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Type</div>
                <div className="text-[13px] capitalize">{dbAgent.type}</div>
              </div>
              {config.model ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Model</div>
                  <div className="text-[13px] font-mono">{String(config.model)}</div>
                </div>
              ) : null}
              {config.max_tokens ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Max Tokens</div>
                  <div className="text-[13px]">{String(config.max_tokens)}</div>
                </div>
              ) : null}
              {config.cost_per_run ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Cost/Run</div>
                  <div className="text-[13px]">${String(config.cost_per_run)}</div>
                </div>
              ) : null}
            </div>
            {dbAgent.description && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-0.5">Description</div>
                <div className="text-[13px] text-[var(--text-dim)]">{dbAgent.description}</div>
              </div>
            )}
          </div>
        )}

        {/* All Tasks with status badges */}
        <div className="p-5">
          <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-3">Tasks ({allTasks.length})</h3>
          {allTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No tasks assigned</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {allTasks.map(t => {
                // Map kanban status to DB-like status for badge
                const dbStatus = t.status === "done" ? "completed" : t.status === "in-progress" || t.status === "review" ? "running" : "pending";
                return (
                  <div key={t.id} className="bg-[var(--card)] rounded-lg p-3 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colColors[t.status] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{t.title}</div>
                      <div className="text-[10px] text-[var(--text-dim)]">{colNames[t.status]} · {t.time}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: taskStatusColors[dbStatus] + "22", color: taskStatusColors[dbStatus] }}>
                      {taskStatusLabels[dbStatus]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-[var(--border)]">
          <button onClick={() => { onOpenChat(); onClose(); }} className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
            💬 Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
