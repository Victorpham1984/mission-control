"use client";
import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { invokeOpenClaw } from "@/lib/openclaw";

// ── Types ──────────────────────────────────────────────
interface CronJob {
  id: string;
  name?: string;
  schedule?: string;
  at?: string;
  every?: string;
  cron?: string;
  enabled?: boolean;
  lastRun?: string;
  lastStatus?: string;
  nextRun?: string;
  session?: string;
  payload?: Record<string, unknown>;
  model?: string;
  timeout?: number;
  delivery?: string;
}

interface CronRun {
  id?: string;
  jobId?: string;
  timestamp: string;
  status: string;
  duration?: number;
  summary?: string;
}

interface CronStatus {
  running?: boolean;
  totalJobs?: number;
  nextRun?: string;
}

interface JobFormData {
  name: string;
  scheduleType: "at" | "every" | "cron";
  atValue: string;
  everyValue: string;
  everyUnit: "minutes" | "hours" | "days";
  cronExpr: string;
  sessionTarget: "main" | "isolated";
  payloadKind: "systemEvent" | "agentTurn";
  message: string;
  model: string;
  timeout: string;
  delivery: "none" | "announce";
  enabled: boolean;
}

const defaultForm: JobFormData = {
  name: "",
  scheduleType: "every",
  atValue: "",
  everyValue: "10",
  everyUnit: "minutes",
  cronExpr: "0 * * * *",
  sessionTarget: "main",
  payloadKind: "systemEvent",
  message: "",
  model: "",
  timeout: "",
  delivery: "none",
  enabled: true,
};

// ── Helpers ────────────────────────────────────────────
function humanSchedule(job: CronJob): string {
  if (job.at) {
    try {
      return "Once at " + new Date(job.at).toLocaleString();
    } catch { return job.at; }
  }
  if (job.every) {
    const m = job.every.match(/^(\d+)\s*(m|min|minutes?|h|hours?|d|days?)$/i);
    if (m) {
      const n = parseInt(m[1]);
      const u = m[2][0].toLowerCase();
      const unit = u === "m" ? "minute" : u === "h" ? "hour" : "day";
      return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
    }
    return `Every ${job.every}`;
  }
  if (job.cron) return `Cron: ${job.cron}`;
  if (job.schedule) return job.schedule;
  return "Unknown";
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs px-2 py-0.5 rounded bg-[var(--card-hover)] text-[var(--text-dim)]">—</span>;
  const s = status.toLowerCase();
  if (s === "ok" || s === "success") return <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">ok</span>;
  if (s === "error" || s === "failed") return <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">error</span>;
  if (s === "running") return <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">running</span>;
  return <span className="text-xs px-2 py-0.5 rounded bg-[var(--card-hover)] text-[var(--text-dim)]">{status}</span>;
}

function SkeletonRow() {
  return (
    <div className="h-16 bg-[var(--card)] rounded-lg animate-pulse mb-2" />
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  } catch { return iso; }
}

// ── Toast ──────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[var(--accent)] text-black px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium animate-modal">
      {message}
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-t-xl md:rounded-xl p-5 md:p-6 max-w-sm w-full md:mx-4 animate-modal" onClick={e => e.stopPropagation()}>
        <p className="text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg bg-[var(--card)] hover:bg-[var(--card-hover)] transition">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Job Form Modal ─────────────────────────────────────
function JobModal({ job, onClose, onSave }: { job: CronJob | null; onClose: () => void; onSave: (data: JobFormData, id?: string) => void }) {
  const isEdit = !!job;
  const [form, setForm] = useState<JobFormData>(() => {
    if (!job) return { ...defaultForm };
    const scheduleType = job.at ? "at" as const : job.cron ? "cron" as const : "every" as const;
    let everyValue = "10", everyUnit: "minutes" | "hours" | "days" = "minutes";
    if (job.every) {
      const m = job.every.match(/^(\d+)\s*(m|min|minutes?|h|hours?|d|days?)$/i);
      if (m) {
        everyValue = m[1];
        const u = m[2][0].toLowerCase();
        everyUnit = u === "h" ? "hours" : u === "d" ? "days" : "minutes";
      }
    }
    const payloadKind = job.payload?.systemEvent ? "systemEvent" as const : "agentTurn" as const;
    return {
      name: job.name || "",
      scheduleType,
      atValue: job.at || "",
      everyValue,
      everyUnit,
      cronExpr: job.cron || "0 * * * *",
      sessionTarget: job.session === "isolated" ? "isolated" as const : "main" as const,
      payloadKind,
      message: (job.payload?.systemEvent as string) || (job.payload?.agentTurn as string) || ((job.payload as Record<string, unknown>)?.text as string) || "",
      model: job.model || "",
      timeout: job.timeout ? String(job.timeout) : "",
      delivery: (job.delivery as "none" | "announce") || "none",
      enabled: job.enabled !== false,
    };
  });

  const set = (partial: Partial<JobFormData>) => setForm(f => ({ ...f, ...partial }));

  const inputCls = "w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition";
  const labelCls = "block text-xs text-[var(--text-dim)] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-t-xl md:rounded-xl w-full md:max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-y-auto animate-modal" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-5 border-b border-[var(--border)] flex justify-between items-center">
          <h2 className="text-base md:text-lg font-bold">{isEdit ? "Edit Job" : "Add New Job"}</h2>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl">×</button>
        </div>
        <div className="p-4 md:p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="My cron job" />
          </div>

          {/* Schedule type */}
          <div>
            <label className={labelCls}>Schedule Type</label>
            <div className="flex gap-2">
              {(["at", "every", "cron"] as const).map(t => (
                <button key={t} onClick={() => set({ scheduleType: t })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${form.scheduleType === t ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
                  {t === "at" ? "One-time" : t === "every" ? "Interval" : "Cron Expression"}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule value */}
          {form.scheduleType === "at" && (
            <div>
              <label className={labelCls}>Date & Time</label>
              <input type="datetime-local" className={inputCls} value={form.atValue} onChange={e => set({ atValue: e.target.value })} />
            </div>
          )}
          {form.scheduleType === "every" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelCls}>Interval</label>
                <input type="number" min="1" className={inputCls} value={form.everyValue} onChange={e => set({ everyValue: e.target.value })} />
              </div>
              <div className="w-32">
                <label className={labelCls}>Unit</label>
                <select className={inputCls} value={form.everyUnit} onChange={e => set({ everyUnit: e.target.value as "minutes" | "hours" | "days" })}>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          )}
          {form.scheduleType === "cron" && (
            <div>
              <label className={labelCls}>Cron Expression</label>
              <input className={inputCls} value={form.cronExpr} onChange={e => set({ cronExpr: e.target.value })} placeholder="0 * * * *" />
              <p className="text-[10px] text-[var(--text-dim)] mt-1">e.g. 0 9 * * * = daily at 9:00 AM</p>
            </div>
          )}

          {/* Session target */}
          <div>
            <label className={labelCls}>Session Target</label>
            <div className="flex gap-3">
              {(["main", "isolated"] as const).map(t => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="session" checked={form.sessionTarget === t}
                    onChange={() => set({ sessionTarget: t, payloadKind: t === "main" ? "systemEvent" : "agentTurn" })}
                    className="accent-[var(--accent)]" />
                  {t === "main" ? "Main" : "Isolated"}
                </label>
              ))}
            </div>
          </div>

          {/* Payload kind */}
          <div>
            <label className={labelCls}>Payload Kind</label>
            <select className={inputCls} value={form.payloadKind} onChange={e => set({ payloadKind: e.target.value as "systemEvent" | "agentTurn" })}>
              <option value="systemEvent">System Event</option>
              <option value="agentTurn">Agent Turn</option>
            </select>
            {form.sessionTarget === "main" && form.payloadKind !== "systemEvent" && (
              <p className="text-[10px] text-amber-400 mt-1">⚠ Main session requires System Event</p>
            )}
            {form.sessionTarget === "isolated" && form.payloadKind !== "agentTurn" && (
              <p className="text-[10px] text-amber-400 mt-1">⚠ Isolated session requires Agent Turn</p>
            )}
          </div>

          {/* Message */}
          <div>
            <label className={labelCls}>Message / Text</label>
            <textarea className={inputCls + " h-20 resize-none"} value={form.message} onChange={e => set({ message: e.target.value })} placeholder="What should this job do?" />
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Model Override (optional)</label>
              <input className={inputCls} value={form.model} onChange={e => set({ model: e.target.value })} placeholder="e.g. claude-sonnet-4-20250514" />
            </div>
            <div>
              <label className={labelCls}>Timeout (seconds)</label>
              <input type="number" className={inputCls} value={form.timeout} onChange={e => set({ timeout: e.target.value })} placeholder="300" />
            </div>
          </div>

          {/* Delivery (isolated only) */}
          {form.sessionTarget === "isolated" && (
            <div>
              <label className={labelCls}>Delivery Mode</label>
              <select className={inputCls} value={form.delivery} onChange={e => set({ delivery: e.target.value as "none" | "announce" })}>
                <option value="none">None</option>
                <option value="announce">Announce</option>
              </select>
            </div>
          )}

          {/* Enabled */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => set({ enabled: e.target.checked })} className="accent-[var(--accent)]" />
            Enabled
          </label>
        </div>

        <div className="p-4 md:p-5 border-t border-[var(--border)] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-[var(--card)] hover:bg-[var(--card-hover)] transition">Cancel</button>
          <button onClick={() => onSave(form, job?.id)} className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition">
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run History Modal ──────────────────────────────────
function RunHistoryModal({ job, onClose }: { job: CronJob; onClose: () => void }) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await invokeOpenClaw("cron", "runs", { id: job.id });
      setRuns(data?.runs || data?.result?.runs || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [job.id]);

  useEffect(() => { fetchRuns(); const i = setInterval(fetchRuns, 30000); return () => clearInterval(i); }, [fetchRuns]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-t-xl md:rounded-xl w-full md:max-w-lg max-h-[85vh] md:max-h-[80vh] overflow-y-auto animate-modal" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-5 border-b border-[var(--border)] flex justify-between items-center">
          <h2 className="text-base md:text-lg font-bold truncate">Run History — {job.name || job.id}</h2>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl">×</button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <SkeletonRow key={i} />)}</div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] text-center py-8">No runs yet</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run, i) => (
                <div key={run.id || i} className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[var(--text-dim)]">{new Date(run.timestamp).toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      {run.duration != null && <span className="text-[10px] text-[var(--text-dim)]">{(run.duration / 1000).toFixed(1)}s</span>}
                      <StatusBadge status={run.status} />
                    </div>
                  </div>
                  {run.summary && <p className="text-xs text-[var(--text-dim)] mt-1 line-clamp-2">{run.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [status, setStatus] = useState<CronStatus>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<CronJob | null | undefined>(undefined); // undefined=closed, null=new, CronJob=edit
  const [deleteJob, setDeleteJob] = useState<CronJob | null>(null);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);

  const showToast = (msg: string) => setToast(msg);

  const fetchAll = useCallback(async () => {
    try {
      const [jobsData, statusData] = await Promise.all([
        invokeOpenClaw("cron", "list"),
        invokeOpenClaw("cron", "status"),
      ]);
      setJobs(jobsData?.jobs || jobsData?.result?.jobs || []);
      setStatus(statusData?.result || statusData || {});
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 30000); return () => clearInterval(i); }, [fetchAll]);

  const handleSave = async (form: JobFormData, id?: string) => {
    const schedule: Record<string, unknown> = {};
    if (form.scheduleType === "at") schedule.at = form.atValue;
    else if (form.scheduleType === "every") schedule.every = `${form.everyValue} ${form.everyUnit}`;
    else schedule.cron = form.cronExpr;

    const payload: Record<string, unknown> = {};
    if (form.payloadKind === "systemEvent") payload.systemEvent = form.message;
    else payload.agentTurn = form.message;

    const args: Record<string, unknown> = {
      name: form.name,
      ...schedule,
      session: form.sessionTarget,
      payload,
      enabled: form.enabled,
    };
    if (form.model) args.model = form.model;
    if (form.timeout) args.timeout = parseInt(form.timeout);
    if (form.sessionTarget === "isolated" && form.delivery !== "none") args.delivery = form.delivery;
    if (id) args.id = id;

    await invokeOpenClaw("cron", id ? "update" : "add", args);
    setModalJob(undefined);
    showToast(id ? "Job updated" : "Job created");
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteJob) return;
    await invokeOpenClaw("cron", "remove", { id: deleteJob.id });
    setDeleteJob(null);
    showToast("Job deleted");
    fetchAll();
  };

  const handleRunNow = async (job: CronJob) => {
    await invokeOpenClaw("cron", "run", { id: job.id });
    showToast(`Triggered: ${job.name || job.id}`);
    setTimeout(fetchAll, 2000);
  };

  const handleToggle = async (job: CronJob) => {
    await invokeOpenClaw("cron", "update", { id: job.id, enabled: !job.enabled });
    showToast(job.enabled ? "Job disabled" : "Job enabled");
    fetchAll();
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 md:p-6 space-y-3 md:space-y-4">
        {/* Status Bar */}
        <div className="flex flex-wrap gap-2 md:gap-3 items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 md:px-4 md:py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.running !== false ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-sm font-medium">{status.running !== false ? "Scheduler Running" : "Scheduler Stopped"}</span>
          </div>
          <span className="text-xs text-[var(--text-dim)]">•</span>
          <span className="text-sm text-[var(--text-dim)]">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
          {status.nextRun && (
            <>
              <span className="text-xs text-[var(--text-dim)]">•</span>
              <span className="text-sm text-[var(--text-dim)]">Next: {timeAgo(status.nextRun)}</span>
            </>
          )}
          <div className="ml-auto">
            <button onClick={() => setModalJob(null)} className="px-4 py-1.5 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition">
              + Add Job
            </button>
          </div>
        </div>

        {/* Job List */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <SkeletonRow key={i} />)}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⏰</p>
            <p className="text-[var(--text-dim)]">No cron jobs yet</p>
            <button onClick={() => setModalJob(null)} className="mt-4 px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition">
              Create your first job
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:bg-[var(--card-hover)] transition group">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setHistoryJob(job)} className="font-semibold text-sm hover:text-[var(--accent)] transition truncate">
                        {job.name || job.id}
                      </button>
                      <StatusBadge status={job.lastStatus} />
                      {job.enabled === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--card-hover)] text-[var(--text-dim)]">disabled</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-dim)]">
                      <span>📅 {humanSchedule(job)}</span>
                      {job.nextRun && <span>Next: {timeAgo(job.nextRun)}</span>}
                      {job.lastRun && <span>Last: {timeAgo(job.lastRun)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <button onClick={() => handleToggle(job)} title={job.enabled !== false ? "Disable" : "Enable"}
                      className={`w-10 h-5 rounded-full relative transition ${job.enabled !== false ? "bg-emerald-500" : "bg-[var(--border)]"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${job.enabled !== false ? "left-5" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => handleRunNow(job)} className="px-2 md:px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition">
                      <span className="md:hidden">▶</span><span className="hidden md:inline">▶ Run</span>
                    </button>
                    <button onClick={() => setModalJob(job)} className="px-2 md:px-3 py-1 text-xs rounded-lg bg-[var(--card-hover)] text-[var(--text-dim)] hover:text-white transition">
                      <span className="md:hidden">✏️</span><span className="hidden md:inline">Edit</span>
                    </button>
                    <button onClick={() => setDeleteJob(job)} className="px-2 md:px-3 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                      <span className="md:hidden">🗑</span><span className="hidden md:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {modalJob !== undefined && <JobModal job={modalJob} onClose={() => setModalJob(undefined)} onSave={handleSave} />}
      {deleteJob && <ConfirmDialog message={`Delete "${deleteJob.name || deleteJob.id}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteJob(null)} />}
      {historyJob && <RunHistoryModal job={historyJob} onClose={() => setHistoryJob(null)} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
