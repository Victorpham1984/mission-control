"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useInstalledPlaybooks, useRunPlaybook } from "@/hooks/usePlaybooks";

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const categoryBadge: Record<string, string> = {
  ecommerce: "bg-emerald-500/20 text-emerald-400",
  content: "bg-purple-500/20 text-purple-400",
  b2b: "bg-blue-500/20 text-blue-400",
  operations: "bg-amber-500/20 text-amber-400",
  marketing: "bg-pink-500/20 text-pink-400",
};

export default function PlaybooksPage() {
  const router = useRouter();
  const { data: playbooks, isLoading } = useInstalledPlaybooks();
  const runMutation = useRunPlaybook();
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await runMutation.mutateAsync(id);
    } catch {
      // Error handled by mutation state
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Installed Playbooks</h1>

        {isLoading && (
          <div className="text-center text-[var(--text-dim)] py-12">Loading...</div>
        )}

        {!isLoading && (!playbooks || playbooks.length === 0) && (
          <div className="text-center text-[var(--text-dim)] py-12">
            <p className="text-lg mb-2">No playbooks installed</p>
            <p className="text-sm">Install a playbook from the marketplace to get started.</p>
          </div>
        )}

        <div className="space-y-3">
          {playbooks?.map((pb) => (
            <div
              key={pb.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition cursor-pointer"
              onClick={() => router.push(`/dashboard/playbooks/${pb.id}/runs`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-lg ${pb.active ? "" : "opacity-40"}`}>
                      {pb.active ? "▶" : "■"}
                    </span>
                    <h3 className="font-semibold truncate">
                      {pb.playbook?.name || "Unnamed Playbook"}
                    </h3>
                    {pb.playbook?.category && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${categoryBadge[pb.playbook.category] || "bg-slate-500/20 text-slate-400"}`}>
                        {pb.playbook.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-dim)] truncate">
                    {pb.playbook?.description || "No description"}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-[var(--text-dim)]">
                    <span>{pb.active ? "Active" : "Paused"}</span>
                    <span>{pb.run_count} runs</span>
                    <span>Last run: {formatTime(pb.last_run_at)}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleRun(pb.id); }}
                  disabled={!pb.active || runningId === pb.id || runMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-black hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {runningId === pb.id ? "Running..." : "Run Now"}
                </button>
              </div>

              {runMutation.isError && runningId === null && (
                <div className="mt-2 text-xs text-red-400">
                  {runMutation.error?.message}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
