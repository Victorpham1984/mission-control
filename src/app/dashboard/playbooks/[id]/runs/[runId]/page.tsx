"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { usePlaybookActions, type ActionRow } from "@/hooks/usePlaybooks";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function evidenceSummary(evidence: Record<string, unknown>): string {
  const skip = new Set(["playbook_run_id", "step_order", "workspace_id", "error"]);
  const entries = Object.entries(evidence)
    .filter(([k]) => !skip.has(k))
    .slice(0, 3);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
}

export default function PlaybookRunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: installedId, runId } = use(params);
  const router = useRouter();
  const { data: actions, isLoading } = usePlaybookActions(installedId, runId);

  const sorted = actions
    ? [...actions].sort((a, b) => {
        const orderA = (a.evidence as Record<string, unknown>)?.step_order as number ?? 0;
        const orderB = (b.evidence as Record<string, unknown>)?.step_order as number ?? 0;
        return orderA - orderB;
      })
    : [];

  const successCount = sorted.filter(a => a.success).length;
  const failCount = sorted.filter(a => !a.success).length;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push(`/dashboard/playbooks/${installedId}/runs`)}
          className="text-sm text-[var(--text-dim)] hover:text-white mb-1"
        >
          &larr; Back to Runs
        </button>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold">Run</h1>
          <code className="text-sm text-[var(--text-dim)] bg-[var(--card)] px-2 py-0.5 rounded">
            {runId.slice(0, 8)}
          </code>
        </div>

        {isLoading && (
          <div className="text-center text-[var(--text-dim)] py-12">Loading...</div>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center text-[var(--text-dim)] py-12">
            <p className="text-lg mb-2">No actions recorded yet</p>
            <p className="text-sm">Actions appear here as agents complete playbook steps.</p>
          </div>
        )}

        {/* Action Timeline */}
        <div className="space-y-1">
          {sorted.map((action, i) => {
            const stepOrder = (action.evidence as Record<string, unknown>)?.step_order as number ?? i + 1;
            return (
              <div
                key={action.id}
                className="flex gap-3 items-start bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`w-3 h-3 rounded-full ${action.success ? "bg-emerald-400" : "bg-red-400"}`} />
                  {i < sorted.length - 1 && (
                    <div className="w-px h-8 bg-[var(--border)] mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Step {stepOrder}: {action.action_type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${action.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {action.success ? "success" : "failed"}
                    </span>
                    <span className="text-xs text-[var(--text-dim)]">
                      {formatDuration(action.duration_ms)}
                    </span>
                  </div>

                  {action.description && (
                    <p className="text-xs text-[var(--text-dim)] mt-1 truncate">
                      {action.description}
                    </p>
                  )}

                  {action.evidence && Object.keys(action.evidence).length > 0 && (
                    <p className="text-xs text-[var(--text-dim)] mt-0.5 font-mono truncate">
                      {evidenceSummary(action.evidence)}
                    </p>
                  )}

                  <div className="text-xs text-[var(--text-dim)] mt-1">
                    {formatTime(action.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {sorted.length > 0 && (
          <div className="mt-6 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
            <div className="flex gap-6 text-sm">
              <span>Total: <strong>{sorted.length}</strong> actions</span>
              <span className="text-emerald-400">Success: {successCount}</span>
              {failCount > 0 && <span className="text-red-400">Failed: {failCount}</span>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
