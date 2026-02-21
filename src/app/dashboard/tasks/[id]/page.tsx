"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTaskDetail } from "@/lib/supabase/approval-hooks";
import { useTaskQueue } from "@/lib/supabase/hooks";
import Header from "@/components/Header";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const statusColors: Record<string, string> = {
  queued: "bg-slate-500/20 text-slate-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  "pending-approval": "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  normal: "bg-blue-500/20 text-blue-400",
  background: "bg-slate-500/20 text-slate-400",
};

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= count ? "text-amber-400" : "text-slate-600"}`}>★</span>
      ))}
    </span>
  );
}

function InteractiveStars({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange(i)}
          className={`text-lg cursor-pointer hover:scale-125 transition-transform ${i <= count ? "text-amber-400" : "text-slate-600"}`}>★</button>
      ))}
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { task, agent, history, loading } = useTaskDetail(id);
  const { approveTask, rejectTask } = useTaskQueue();

  // Approval form state
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rejectAction, setRejectAction] = useState<"revise" | "reassign" | "cancel">("revise");

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">📋</div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-lg font-bold mb-1">Task not found</h2>
            <button onClick={() => router.back()} className="text-sm text-[var(--accent)] hover:underline mt-2">← Go back</button>
          </div>
        </div>
      </div>
    );
  }

  const output = task.output ? (typeof task.output === "string" ? task.output : JSON.stringify(task.output, null, 2)) : null;
  const isCode = output && (output.includes("{") || output.includes("function") || output.includes("import "));
  const isPendingApproval = task.status === "pending-approval";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] mb-4">
            <button onClick={() => router.push("/")} className="hover:text-white transition">Dashboard</button>
            <span>/</span>
            <span className="text-white">{task.title}</span>
          </div>

          {/* Title section */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl md:text-2xl font-bold mb-2">{task.title}</h1>
              <div className="flex flex-wrap gap-2">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusColors[task.status] || statusColors.queued}`}>{task.status}</span>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${priorityColors[task.priority] || priorityColors.normal}`}>{task.priority}</span>
                {task.duration_ms && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--card)] text-[var(--text-dim)]">⏱ {formatDuration(task.duration_ms)}</span>}
              </div>
            </div>
            {isPendingApproval && (
              <div className="flex gap-2">
                <button onClick={() => { setShowApprove(true); setShowReject(false); }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition">✅ Approve</button>
                <button onClick={() => { setShowReject(true); setShowApprove(false); }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition">❌ Reject</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Main content */}
            <div className="md:col-span-2 space-y-4">
              {/* Description */}
              {task.description && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Description</h3>
                  <p className="text-sm leading-relaxed">{task.description}</p>
                </div>
              )}

              {/* Required Skills */}
              {task.required_skills && task.required_skills.length > 0 && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Required Skills</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {task.required_skills.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface)] text-[var(--text-dim)]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Output */}
              {output && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Output</h3>
                  <pre className={`text-xs rounded-lg p-3 bg-[var(--surface)] overflow-x-auto max-h-96 whitespace-pre-wrap ${isCode ? "font-mono text-green-300" : ""}`}>
                    {output}
                  </pre>
                </div>
              )}

              {/* Error */}
              {task.error && (
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                  <h3 className="text-xs uppercase tracking-wider text-red-400 mb-2">Error</h3>
                  <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap">{task.error}</pre>
                </div>
              )}

              {/* Approval info */}
              {task.approval_status === "approved" && (
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                  <h3 className="text-xs uppercase tracking-wider text-green-400 mb-2">Approved</h3>
                  <div className="flex items-center gap-3">
                    {task.approval_rating && <Stars count={task.approval_rating} />}
                    {task.approval_feedback && <span className="text-sm">{task.approval_feedback}</span>}
                  </div>
                </div>
              )}

              {task.approval_status === "rejected" && (
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                  <h3 className="text-xs uppercase tracking-wider text-red-400 mb-2">Rejected</h3>
                  {task.approval_feedback && <p className="text-sm">{task.approval_feedback}</p>}
                </div>
              )}

              {/* Approve form */}
              {showApprove && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-green-500/30 space-y-3">
                  <h3 className="font-semibold text-sm">Approve Task</h3>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-2">Rating</label>
                    <InteractiveStars count={rating} onChange={setRating} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Comment</label>
                    <textarea value={comment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowApprove(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition">Cancel</button>
                    <button onClick={async () => { await approveTask(id, rating, comment); setShowApprove(false); }}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition">Confirm</button>
                  </div>
                </div>
              )}

              {/* Reject form */}
              {showReject && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-red-500/30 space-y-3">
                  <h3 className="font-semibold text-sm">Reject Task</h3>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-dim)] block mb-1">Feedback</label>
                    <textarea value={feedback} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]" />
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
                    <button onClick={() => setShowReject(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition">Cancel</button>
                    <button onClick={async () => { if (feedback.trim()) { await rejectTask(id, feedback, rejectAction); setShowReject(false); } }}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50" disabled={!feedback.trim()}>Confirm</button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Agent */}
              {agent && (
                <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Assigned Agent</h3>
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(`/dashboard/agents/${agent.id}`)}>
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface)] flex items-center justify-center text-xl">{agent.avatar_emoji || "🤖"}</div>
                    <div>
                      <div className="font-semibold text-sm">{agent.name}</div>
                      <div className="text-[11px] text-[var(--text-dim)]">{agent.role}</div>
                    </div>
                  </div>
                  {agent.skills && agent.skills.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-3">
                      {agent.skills.map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Timeline</h3>
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0 mt-1" />
                        {i < history.length - 1 && <div className="w-px flex-1 bg-[var(--border)] mt-1" />}
                      </div>
                      <div className="pb-3">
                        <div className="text-xs font-semibold">{h.event}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{formatTime(h.time)}</div>
                        {h.detail && <div className="text-[10px] text-[var(--accent-light)] mt-0.5">{h.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-[var(--text-dim)]">ID</span><span className="font-mono text-[10px]">{task.id.slice(0, 8)}...</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-dim)]">Type</span><span>{task.type || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-dim)]">Created</span><span>{formatTime(task.created_at)}</span></div>
                  {task.claimed_at && <div className="flex justify-between"><span className="text-[var(--text-dim)]">Claimed</span><span>{formatTime(task.claimed_at)}</span></div>}
                  {task.completed_at && <div className="flex justify-between"><span className="text-[var(--text-dim)]">Completed</span><span>{formatTime(task.completed_at)}</span></div>}
                  {task.duration_ms && <div className="flex justify-between"><span className="text-[var(--text-dim)]">Duration</span><span>{formatDuration(task.duration_ms)}</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
