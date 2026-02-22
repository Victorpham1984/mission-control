"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/utils/toast";
import AgentProfileEditor from "./AgentProfileEditor";

interface AgentItem {
  id: string;
  name: string;
  avatar_emoji: string | null;
  status: string;
  about: string | null;
  skills: string[] | null;
  role: string | null;
  config?: Record<string, unknown>;
}

interface AgentProfileListProps {
  workspaceId: string;
}

export default function AgentProfileList({ workspaceId }: AgentProfileListProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: agents = [], isLoading } = useQuery<AgentItem[]>({
    queryKey: ["agents", workspaceId],
    queryFn: () => fetch(`/api/v1/agents?workspace_id=${workspaceId}`).then(r => r.json()).then(d => d.agents || d || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) =>
      fetch(`/api/v1/agents/${agentId}?workspace_id=${workspaceId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Failed to delete agent"),
  });

  const statusDot: Record<string, string> = {
    online: "bg-green-400 shadow-[0_0_6px_#4ade80]",
    offline: "bg-slate-400",
    error: "bg-red-400 shadow-[0_0_6px_#f87171]",
    paused: "bg-yellow-400",
  };

  if (editingId) {
    return (
      <AgentProfileEditor
        agentId={editingId}
        workspaceId={workspaceId}
        onSave={() => { setEditingId(null); queryClient.invalidateQueries({ queryKey: ["agents"] }); }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[var(--card)] rounded-2xl p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--border)]" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--border)] rounded w-32 mb-2" />
                <div className="h-3 bg-[var(--border)] rounded w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
        <div className="text-5xl mb-4">🤖</div>
        <h3 className="text-lg font-semibold mb-2">Create your first agent</h3>
        <p className="text-sm text-[var(--text-dim)] mb-6">Agents handle tasks autonomously with custom personas and behaviors</p>
        <button className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
          + New Agent
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div key={agent.id} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:bg-[var(--card-hover)] transition group">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-2xl shrink-0">
              {agent.avatar_emoji || "🤖"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{agent.name}</h3>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[agent.status] || statusDot.offline}`} />
                {agent.role && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-dim)]">{agent.role}</span>}
              </div>
              <p className="text-sm text-[var(--text-dim)] truncate mt-0.5">{agent.about || "No description"}</p>
              {agent.skills && agent.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.skills.slice(0, 4).map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--accent)]">{s}</span>
                  ))}
                  {agent.skills.length > 4 && <span className="text-xs text-[var(--text-dim)]">+{agent.skills.length - 4}</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition shrink-0">
              <button onClick={() => setEditingId(agent.id)} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface)] transition">Edit</button>
              <button onClick={() => setDeleteConfirm(agent.id)} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-red-500/20 hover:border-red-500/50 text-[var(--red)] transition">Delete</button>
            </div>
          </div>

          {/* Delete Confirmation */}
          {deleteConfirm === agent.id && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
              <p className="text-sm">Delete <strong>{agent.name}</strong>? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface)]">Cancel</button>
                <button onClick={() => deleteMutation.mutate(agent.id)} disabled={deleteMutation.isPending} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--red)] text-white hover:brightness-110 disabled:opacity-50">
                  {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
