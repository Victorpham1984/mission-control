"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeDate } from "@/lib/utils/format";

interface MemoryItem {
  id: string;
  agentId: string;
  agentName: string;
  type: "learning" | "feedback" | "correction";
  content: string;
  source: string;
  createdAt: string;
}

interface AgentMemoryTimelineProps {
  workspaceId: string;
  agentFilter?: string;
}

export default function AgentMemoryTimeline({ workspaceId, agentFilter: initialFilter }: AgentMemoryTimelineProps) {
  const [agentFilter, setAgentFilter] = useState(initialFilter || "all");

  const { data: memories = [], isLoading } = useQuery<MemoryItem[]>({
    queryKey: ["agent-memories", workspaceId, agentFilter],
    queryFn: () => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (agentFilter !== "all") params.append("agent_id", agentFilter);
      return fetch(`/api/v1/agents/memories?${params}`).then(r => r.json()).then(d => d.memories || d || []);
    },
  });

  const { data: agents = [] } = useQuery<{ id: string; name: string; avatar_emoji: string }[]>({
    queryKey: ["agents-list", workspaceId],
    queryFn: () => fetch(`/api/v1/agents?workspace_id=${workspaceId}`).then(r => r.json()).then(d => d.agents || d || []),
  });

  const typeIcons: Record<string, string> = {
    learning: "🧠",
    feedback: "💬",
    correction: "✏️",
  };

  const typeColors: Record<string, string> = {
    learning: "border-[var(--blue)]",
    feedback: "border-[var(--green)]",
    correction: "border-[var(--orange)]",
  };

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <div className="p-6 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Agent Memory Timeline</h2>
          <p className="text-sm text-[var(--text-dim)]">Learnings from feedback and corrections</p>
        </div>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
          <option value="all">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.avatar_emoji || "🤖"} {a.name}</option>)}
        </select>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[var(--surface)] rounded-xl animate-pulse" />)}
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-dim)]">
            <div className="text-4xl mb-3">🧠</div>
            <p>No memories yet</p>
            <p className="text-xs mt-1">Agents learn from task feedback and corrections</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-2 bottom-2 w-px bg-[var(--border)]" />

            <div className="space-y-4">
              {memories.map((memory) => (
                <div key={memory.id} className={`relative pl-12 border-l-2 ml-4 ${typeColors[memory.type] || "border-[var(--border)]"}`}>
                  {/* Icon */}
                  <div className="absolute -left-[13px] top-1 w-6 h-6 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-sm">
                    {typeIcons[memory.type] || "📝"}
                  </div>

                  <div className="bg-[var(--surface)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] capitalize">{memory.type}</span>
                        <span className="text-xs text-[var(--text-dim)]">{memory.agentName}</span>
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">{formatRelativeDate(memory.createdAt)}</span>
                    </div>
                    <p className="text-sm">{memory.content}</p>
                    <p className="text-xs text-[var(--text-dim)] mt-2">Source: {memory.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
