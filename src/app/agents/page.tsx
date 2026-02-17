"use client";
import { useState } from "react";
import { useWorkspaceData } from "@/lib/supabase/hooks";
import AgentProfileModal from "@/components/AgentProfileModal";
import Header from "@/components/Header";
import type { Agent } from "@/lib/data";

const badgeClass: Record<string, string> = { lead: "bg-amber-500 text-black", spc: "bg-purple-500 text-white", int: "bg-blue-500 text-white" };
const badgeLabel: Record<string, string> = { lead: "Lead", spc: "Specialist", int: "Integrator" };
const statusDot: Record<string, string> = { working: "bg-green-400 shadow-[0_0_6px_#4ade80]", idle: "bg-slate-400", error: "bg-red-400 shadow-[0_0_6px_#f87171]" };
const statusLabel: Record<string, string> = { working: "Working", idle: "Idle", error: "Error" };

export default function AgentsPage() {
  const { agents, dbAgents, tasks, loading } = useWorkspaceData();
  const [profileAgent, setProfileAgent] = useState<Agent | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = statusFilter === "all" ? agents : agents.filter(a => a.status === statusFilter);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🤖</div>
          <div className="text-[var(--text-dim)] text-sm">Loading agents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Agents</h1>
              <p className="text-sm text-[var(--text-dim)]">{agents.length} agents · {agents.filter(a => a.status === "working").length} active</p>
            </div>
            <div className="flex gap-1.5">
              {["all", "working", "idle", "error"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition capitalize ${statusFilter === s ? "bg-[var(--accent)] text-black border-[var(--accent)] font-semibold" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
                  {s === "all" ? "All" : statusLabel[s]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-dim)]">
              <div className="text-4xl mb-3">🤖</div>
              <p>No agents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(a => {
                const agentTasks = tasks.filter(t => t.agent === a.id);
                const activeTasks = agentTasks.filter(t => t.status !== "done").length;
                return (
                  <div key={a.id} onClick={() => setProfileAgent(a)}
                    className="bg-[var(--card)] rounded-xl p-5 cursor-pointer border border-transparent hover:border-[var(--border)] hover:bg-[var(--card-hover)] hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: a.color + "22", color: a.color }}>{a.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center gap-2">
                          {a.name}
                          <span className={`w-2 h-2 rounded-full ${statusDot[a.status]}`} />
                        </div>
                        <div className="text-xs text-[var(--text-dim)] truncate">{a.role}</div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${badgeClass[a.badge]}`}>{badgeLabel[a.badge]}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-dim)]">
                      <span>{agentTasks.length} tasks</span>
                      <span>{activeTasks} active</span>
                      <span className="ml-auto capitalize">{statusLabel[a.status]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {profileAgent && (
        <AgentProfileModal
          agent={profileAgent}
          dbAgent={dbAgents.find(d => d.id === profileAgent.id)}
          tasks={tasks}
          onClose={() => setProfileAgent(null)}
          onOpenChat={() => {}}
        />
      )}
    </div>
  );
}
