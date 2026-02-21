"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTaskQueue, type TaskQueueItem } from "@/lib/supabase/hooks";

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
  if (mins < 60) return `${mins}m waiting`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m waiting`;
}

function outputPreview(output: Record<string, unknown> | null): string {
  if (!output) return "No output";
  const str = typeof output === "string" ? output : JSON.stringify(output);
  return str.length > 150 ? str.slice(0, 150) + "…" : str;
}

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  normal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  background: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

function Stars({ count, interactive, onChange }: { count: number; interactive?: boolean; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => interactive && onChange?.(i)}
          className={`text-sm ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} ${i <= count ? "text-amber-400" : "text-slate-600"}`}
          disabled={!interactive}
        >★</button>
      ))}
    </div>
  );
}

// Approve Modal
function ApproveModal({ task, onApprove, onClose }: { task: TaskQueueItem; onApprove: (rating: number, comment: string) => void; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)]">
          <h3 className="font-semibold">Approve: {task.title}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Rating</label>
            <Stars count={rating} interactive onChange={setRating} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Comment (optional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" placeholder="Great work!" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">Cancel</button>
            <button onClick={() => onApprove(rating, comment)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition">✅ Approve</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reject Modal
function RejectModal({ task, onReject, onClose }: { task: TaskQueueItem; onReject: (feedback: string, action: "revise" | "reassign" | "cancel") => void; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [action, setAction] = useState<"revise" | "reassign" | "cancel">("revise");
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)]">
          <h3 className="font-semibold">Reject: {task.title}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Feedback</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" placeholder="What needs to change..." />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Action</label>
            <div className="flex gap-2">
              {(["revise", "reassign", "cancel"] as const).map(a => (
                <button key={a} onClick={() => setAction(a)} className={`flex-1 py-2 rounded-lg text-xs border transition capitalize ${action === a ? "bg-[var(--accent)] text-black border-[var(--accent)] font-semibold" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card)] transition">Cancel</button>
            <button onClick={() => { if (feedback.trim()) onReject(feedback, action); }} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50" disabled={!feedback.trim()}>❌ Reject</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutcomeDashboard() {
  const router = useRouter();
  const { pendingApprovals, activeTasks, completedTasks, queuedTasks, metrics, loading, approveTask, rejectTask } = useTaskQueue();
  const [approveTarget, setApproveTarget] = useState<TaskQueueItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TaskQueueItem | null>(null);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <div className="text-[var(--text-dim)] text-sm">Loading task queue...</div>
        </div>
      </div>
    );
  }

  const noTasks = metrics.completed + metrics.pendingApproval + metrics.inProgress + metrics.failed + metrics.queued === 0;
  if (noTasks) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-bold mb-2">No tasks in queue</h2>
          <p className="text-[var(--text-dim)] text-sm">Tasks created via the CommandMate API will appear here with real-time updates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        {[
          { label: "Completed", value: metrics.completed, color: "text-green-400", icon: "✅" },
          { label: "Pending Approval", value: metrics.pendingApproval, color: "text-amber-400", icon: "⏳" },
          { label: "In Progress", value: metrics.inProgress, color: "text-blue-400", icon: "🔄" },
          { label: "Queued", value: metrics.queued, color: "text-slate-400", icon: "📥" },
          { label: "Failed", value: metrics.failed, color: "text-red-400", icon: "❌" },
        ].map(s => (
          <div key={s.label} className="bg-[var(--card)] rounded-xl p-3 md:p-4 border border-[var(--border)]">
            <div className="text-xs text-[var(--text-dim)] mb-1">{s.icon} {s.label}</div>
            <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending Approvals Widget */}
      {pendingApprovals.length > 0 && (
        <div onClick={() => router.push("/dashboard/approvals")}
          className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30 cursor-pointer hover:bg-amber-500/15 transition flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <div className="font-semibold text-sm">Pending Approvals</div>
              <div className="text-xs text-amber-400">{pendingApprovals.length} task{pendingApprovals.length !== 1 ? "s" : ""} waiting for your review</div>
            </div>
          </div>
          <span className="text-[var(--accent)] text-sm">Review →</span>
        </div>
      )}

      {/* Approval Queue */}
      {pendingApprovals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              Approval Queue ({pendingApprovals.length})
            </h2>
            <button onClick={() => router.push("/dashboard/approvals")} className="text-xs text-[var(--accent)] hover:underline">View All →</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApprovals.map(t => (
              <div key={t.id} className="bg-[var(--card)] rounded-xl p-4 border border-amber-500/30 hover:border-amber-500/50 transition">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm">{t.title}</div>
                  <span className="text-[10px] text-amber-400 shrink-0 ml-2">{formatWaiting(t.completed_at)}</span>
                </div>
                {t.assigned_agent_name && (
                  <div className="text-xs text-[var(--text-dim)] mb-2">{t.assigned_agent_emoji || "🤖"} {t.assigned_agent_name}</div>
                )}
                <div className="text-xs text-[var(--text-dim)] bg-[var(--surface)] rounded-lg p-2 mb-3 line-clamp-3 font-mono">
                  {outputPreview(t.output)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setApproveTarget(t)} className="flex-1 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition border border-green-600/30">✅ Approve</button>
                  <button onClick={() => setRejectTarget(t)} className="flex-1 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition border border-red-600/30">❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Active Tasks ({activeTasks.length})
          </h2>
          <div className="space-y-2">
            {activeTasks.map(t => (
              <div key={t.id} className="bg-[var(--card)] rounded-xl p-3 md:p-4 border border-[var(--border)] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {t.assigned_agent_emoji || "🤖"} {t.assigned_agent_name || "Unassigned"}
                    {t.status_message && <span className="ml-2 text-blue-400">— {t.status_message}</span>}
                  </div>
                </div>
                <div className="w-24 md:w-32 shrink-0">
                  <div className="flex justify-between text-[10px] text-[var(--text-dim)] mb-1">
                    <span>{t.progress_percent ?? 0}%</span>
                    <span>{formatTime(t.claimed_at)}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${t.progress_percent ?? 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Completions */}
      {completedTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-green-400 mb-3">✅ Recent Completions</h2>
          <div className="space-y-2">
            {completedTasks.slice(0, 10).map(t => (
              <div key={t.id} className="bg-[var(--card)] rounded-xl p-3 border border-[var(--border)] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  <div className="text-xs text-[var(--text-dim)]">{t.assigned_agent_emoji || "🤖"} {t.assigned_agent_name || "—"}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {t.approval_rating && <Stars count={t.approval_rating} />}
                  <span className="text-[10px] text-[var(--text-dim)]">{formatTime(t.completed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Queue */}
      {queuedTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">📥 Queue ({queuedTasks.length})</h2>
          <div className="space-y-2">
            {queuedTasks.map(t => (
              <div key={t.id} className="bg-[var(--card)] rounded-xl p-3 border border-[var(--border)] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  {t.required_skills && t.required_skills.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {t.required_skills.map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityBadge[t.priority] || priorityBadge.normal}`}>
                  {t.priority}
                </span>
                <span className="text-[10px] text-[var(--text-dim)]">{formatTime(t.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {approveTarget && (
        <ApproveModal
          task={approveTarget}
          onApprove={async (rating, comment) => {
            await approveTask(approveTarget.id, rating, comment);
            setApproveTarget(null);
          }}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {rejectTarget && (
        <RejectModal
          task={rejectTarget}
          onReject={async (feedback, action) => {
            await rejectTask(rejectTarget.id, feedback, action);
            setRejectTarget(null);
          }}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
