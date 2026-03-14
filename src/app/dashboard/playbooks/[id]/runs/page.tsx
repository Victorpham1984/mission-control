"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { usePlaybookActions, useRunPlaybook, type ActionRow } from "@/hooks/usePlaybooks";

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type RunSummary = {
  runId: string;
  totalSteps: number;
  successSteps: number;
  failedSteps: number;
  latestAction: string;
};

function groupByRun(actions: ActionRow[]): RunSummary[] {
  const runs = new Map<string, ActionRow[]>();

  for (const action of actions) {
    const runId = (action.evidence as Record<string, unknown>)?.playbook_run_id as string;
    if (!runId) continue;
    if (!runs.has(runId)) runs.set(runId, []);
    runs.get(runId)!.push(action);
  }

  return Array.from(runs.entries()).map(([runId, items]) => ({
    runId,
    totalSteps: items.length,
    successSteps: items.filter(a => a.success).length,
    failedSteps: items.filter(a => !a.success).length,
    latestAction: items[0].created_at,
  }));
}

export default function PlaybookRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: installedId } = use(params);
  const router = useRouter();
  const { data: actions, isLoading } = usePlaybookActions(installedId);
  const runMutation = useRunPlaybook();
  const [isRunning, setIsRunning] = useState(false);

  const runs = actions ? groupByRun(actions) : [];

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await runMutation.mutateAsync(installedId);
    } catch {
      // handled by mutation state
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push("/dashboard/playbooks")}
              className="text-sm text-[var(--text-dim)] hover:text-white mb-1"
            >
              &larr; Back to Playbooks
            </button>
            <h1 className="text-2xl font-bold">Run History</h1>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-black hover:brightness-110 transition disabled:opacity-40"
          >
            {isRunning ? "Running..." : "Run Now"}
          </button>
        </div>

        {runMutation.isError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {runMutation.error?.message}
          </div>
        )}

        {isLoading && (
          <div className="text-center text-[var(--text-dim)] py-12">Loading...</div>
        )}

        {!isLoading && runs.length === 0 && (
          <div className="text-center text-[var(--text-dim)] py-12">
            <p className="text-lg mb-2">No runs yet</p>
            <p className="text-sm">Click &quot;Run Now&quot; to trigger the first execution.</p>
          </div>
        )}

        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.runId}
              onClick={() => router.push(`/dashboard/playbooks/${installedId}/runs/${run.runId}`)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {run.failedSteps > 0 ? "⚠️" : "✅"}
                  </span>
                  <div>
                    <div className="font-mono text-sm">{run.runId.slice(0, 8)}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {run.successSteps}/{run.totalSteps} steps &middot; {formatTime(run.latestAction)}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-dim)]">View &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
