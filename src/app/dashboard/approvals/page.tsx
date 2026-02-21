"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTaskQueue, type TaskQueueItem } from "@/lib/supabase/hooks";
import Header from "@/components/Header";

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

function formatWaiting(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function outputPreview(output: Record<string, unknown> | null): string {
  if (!output) return "No output";
  const content = (output.content as string) || (output.result as string) || JSON.stringify(output);
  return content.length > 200 ? content.slice(0, 200) + "…" : content;
}

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  normal: "bg-blue-500/20 text-blue-400",
  background: "bg-slate-500/20 text-slate-400",
};

function Stars({ count, interactive, onChange }: { count: number; interactive?: boolean; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => interactive && onChange?.(i)}
          className={`text-lg ${interactive ? "cursor-pointer hover:scale-125 transition-transform" : "cursor-default"} ${i <= count ? "text-amber-400" : "text-slate-600"}`}
          disabled={!interactive}>★</button>
      ))}
    </div>
  );
}

// Detail Modal
function TaskDetailModal({ task, onApprove, onReject, onClose }: {
  task: TaskQueueItem;
  onApprove: (rating: number, comment: string) => void;
  onReject: (feedback: string, action: "revise" | "reassign" | "cancel") => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rejectAction, setRejectAction] = useState<"revise" | "reassign" | "cancel">("revise");

  const output = task.output ? (typeof task.output === "string" ? task.output : JSON.stringify(task.output, null, 2)) : "No output";
  const isCode = output.includes("{") || output.includes("function") || output.includes("import ");

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-t-2xl md:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-[var(--border)] flex justify-between items-start sticky top-0 bg-[var(--surface)] z-10">
          <div>
            <h2 className="text-base font-semibold">{task.title}</h2>
            <div className="text-xs text-[var(--text-dim)] mt-1 flex items-center gap-2">
              {task.assigned_agent_emoji && <span>{task.assigned_agent_emoji}</span>}
              {task.assigned_agent_name || "Unassigned"}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${priorityBadge[task.priority] || priorityBadge.normal}`}>{task.priority}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white px-2 text-xl">×</button>
        </div>

        <div className="p-4 md:p-5 space-y-4">
          {/* Task description */}
          {task.description && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-1">Input</h3>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          {/* Output */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-1">Output</h3>
            <pre className={`text-xs bg-[var(--card)] rounded-lg p-3 overflow-x-auto max-h-64 whitespace-pre-wrap ${isCode ? "font-mono text-green-300" : ""}`}>
              {output}
            </pre>
          </div>

          {/* Agent info */}
          {task.assigned_agent_name && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-1">Agent</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{task.assigned_agent_emoji || "🤖"}</span>
                <span className="font-semibold">{task.assigned_agent_name}</span>
              </div>
              {task.required_skills && task.required_skills.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {task.required_skills.map(s => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--card)] text-[var(--text-dim)]">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Timeline</h3>
            <div className="space-y-2">
              {[
                task.created_at && { event: "Created", time: task.created_at },
                task.claimed_at && { event: "Claimed", time: task.claimed_at },
                task.completed_at && { event: task.status === "failed" ? "Failed" : "Completed", time: task.completed_at },
              ].filter(Boolean).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  <span className="font-medium">{(e as { event: string }).event}</span>
                  <span className="text-[var(--text-dim)]">{formatTime((e as { time: string }).time)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {mode === "view" && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMode("approve")} className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition">✅ Approve</button>
              <button onClick={() => setMode("reject")} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition">❌ Reject</button>
            </div>
          )}

          {/* Approve form */}
          {mode === "approve" && (
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Rating</label>
                <Stars count={rating} interactive onChange={setRating} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Comment</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" placeholder="Optional comment..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode("view")} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">Back</button>
                <button onClick={() => onApprove(rating, comment)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition">✅ Confirm Approve</button>
              </div>
            </div>
          )}

          {/* Reject form */}
          {mode === "reject" && (
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Feedback</label>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" placeholder="What needs to change..." />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Action</label>
                <div className="flex gap-2">
                  {(["revise", "reassign", "cancel"] as const).map(a => (
                    <button key={a} onClick={() => setRejectAction(a)}
                      className={`flex-1 py-2 rounded-lg text-xs border transition capitalize ${rejectAction === a ? "bg-[var(--accent)] text-black border-[var(--accent)] font-semibold" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>{a}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode("view")} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">Back</button>
                <button onClick={() => { if (feedback.trim()) onReject(feedback, rejectAction); }}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50" disabled={!feedback.trim()}>❌ Confirm Reject</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SortKey = "date" | "agent";
type SortDir = "asc" | "desc";

export default function ApprovalsPage() {
  const router = useRouter();
  const { pendingApprovals, loading, approveTask, rejectTask } = useTaskQueue();
  const [selectedTask, setSelectedTask] = useState<TaskQueueItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRating, setBulkRating] = useState(5);
  const [processing, setProcessing] = useState(false);

  // Unique agents for filter
  const agents = useMemo(() => {
    const map = new Map<string, string>();
    pendingApprovals.forEach(t => {
      if (t.assigned_agent_id && t.assigned_agent_name) {
        map.set(t.assigned_agent_id, `${t.assigned_agent_emoji || "🤖"} ${t.assigned_agent_name}`);
      }
    });
    return Array.from(map.entries());
  }, [pendingApprovals]);

  // Filter & sort
  const filtered = useMemo(() => {
    let items = [...pendingApprovals];
    if (agentFilter !== "all") items = items.filter(t => t.assigned_agent_id === agentFilter);
    items.sort((a, b) => {
      if (sortKey === "date") {
        const ta = new Date(a.completed_at || a.created_at || 0).getTime();
        const tb = new Date(b.completed_at || b.created_at || 0).getTime();
        return sortDir === "asc" ? ta - tb : tb - ta;
      }
      const na = a.assigned_agent_name || "";
      const nb = b.assigned_agent_name || "";
      return sortDir === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
    });
    return items;
  }, [pendingApprovals, agentFilter, sortKey, sortDir]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleBulkApprove = async () => {
    setProcessing(true);
    for (const id of selected) {
      try { await approveTask(id, bulkRating); } catch { /* continue */ }
    }
    setSelected(new Set());
    setBulkApproveOpen(false);
    setProcessing(false);
  };

  const handleBulkReject = async () => {
    setProcessing(true);
    for (const id of selected) {
      try { await rejectTask(id, "Bulk rejected", "revise"); } catch { /* continue */ }
    }
    setSelected(new Set());
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">⏳</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Approval Queue</h1>
              <p className="text-sm text-[var(--text-dim)]">{pendingApprovals.length} tasks waiting for review</p>
            </div>
            <button onClick={() => router.push("/")} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-dim)] hover:bg-[var(--card)] transition">
              ← Back to Dashboard
            </button>
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs">
              <option value="all">All Agents</option>
              {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button onClick={() => handleSort("date")}
              className={`px-3 py-1.5 rounded-lg border text-xs transition ${sortKey === "date" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
              Date {sortKey === "date" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            <button onClick={() => handleSort("agent")}
              className={`px-3 py-1.5 rounded-lg border text-xs transition ${sortKey === "agent" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
              Agent {sortKey === "agent" && (sortDir === "asc" ? "↑" : "↓")}
            </button>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setBulkApproveOpen(true)} disabled={processing}
                  className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition border border-green-600/30 disabled:opacity-50">
                  ✅ Approve {selected.size}
                </button>
                <button onClick={handleBulkReject} disabled={processing}
                  className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition border border-red-600/30 disabled:opacity-50">
                  ❌ Reject {selected.size}
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-dim)]">
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-lg font-bold mb-1">All caught up!</h2>
              <p className="text-sm">No tasks waiting for approval.</p>
            </div>
          ) : (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[40px_1fr_160px_200px_100px_80px] gap-2 px-4 py-3 border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--text-dim)]">
                <div><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-[var(--accent)]" /></div>
                <div>Task</div>
                <div>Agent</div>
                <div>Output Preview</div>
                <div>Waiting</div>
                <div>Priority</div>
              </div>

              {/* Rows */}
              {filtered.map(t => (
                <div key={t.id}
                  className="grid grid-cols-1 md:grid-cols-[40px_1fr_160px_200px_100px_80px] gap-2 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--card-hover)] transition cursor-pointer items-center"
                  onClick={() => setSelectedTask(t)}>
                  <div className="hidden md:block" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="accent-[var(--accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-[11px] text-[var(--text-dim)] md:hidden mt-0.5">
                      {t.assigned_agent_emoji || "🤖"} {t.assigned_agent_name} · {formatWaiting(t.completed_at)} · {t.priority}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                    <span>{t.assigned_agent_emoji || "🤖"}</span>
                    <span className="truncate">{t.assigned_agent_name || "—"}</span>
                  </div>
                  <div className="hidden md:block text-xs text-[var(--text-dim)] truncate font-mono">{outputPreview(t.output)}</div>
                  <div className="hidden md:block text-xs text-amber-400">{formatWaiting(t.completed_at)}</div>
                  <div className="hidden md:block">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityBadge[t.priority] || priorityBadge.normal}`}>{t.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onApprove={async (rating, comment) => {
            await approveTask(selectedTask.id, rating, comment);
            setSelectedTask(null);
          }}
          onReject={async (feedback, action) => {
            await rejectTask(selectedTask.id, feedback, action);
            setSelectedTask(null);
          }}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Bulk approve modal */}
      {bulkApproveOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setBulkApproveOpen(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm border border-[var(--border)] animate-modal p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">Bulk Approve {selected.size} Tasks</h3>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Rating for all</label>
              <Stars count={bulkRating} interactive onChange={setBulkRating} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBulkApproveOpen(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">Cancel</button>
              <button onClick={handleBulkApprove} disabled={processing}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition disabled:opacity-50">
                {processing ? "Processing..." : "✅ Approve All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
