"use client";
import { type Agent, type Task, colNames, colColors } from "@/lib/data";

const badgeLabel: Record<string, string> = { lead: "Lead", spc: "Specialist", int: "Integrator" };
const badgeClass: Record<string, string> = { lead: "bg-amber-500 text-black", spc: "bg-purple-500 text-white", int: "bg-blue-500 text-white" };
const statusLabel: Record<string, string> = { working: "🟢 Working", idle: "⚪ Idle", error: "🔴 Error" };

type Props = {
  agent: Agent;
  tasks: Task[];
  onClose: () => void;
  onOpenChat: () => void;
};

export default function AgentProfileModal({ agent, tasks, onClose, onOpenChat }: Props) {
  const assignedTasks = tasks.filter(t => t.agent === agent.id && t.status !== "done");
  const mentionedTasks = tasks.filter(t => t.desc.toLowerCase().includes(agent.name.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(agent.id)));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-white text-xl">×</button>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ background: agent.color + "22", color: agent.color }}>{agent.emoji}</div>
          <h2 className="text-lg font-bold">{agent.name}</h2>
          <p className="text-sm text-[var(--text-dim)]">{agent.role}</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeClass[agent.badge]}`}>{badgeLabel[agent.badge]}</span>
            <span className="text-xs text-[var(--text-dim)]">{statusLabel[agent.status]}</span>
          </div>
        </div>

        {/* Assigned Tasks */}
        <div className="p-5">
          <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-3">Assigned Tasks ({assignedTasks.length})</h3>
          {assignedTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No active tasks</p>
          ) : (
            <div className="space-y-2">
              {assignedTasks.map(t => (
                <div key={t.id} className="bg-[var(--card)] rounded-lg p-3 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colColors[t.status] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{colNames[t.status]} · {t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unread Mentions */}
        <div className="px-5 pb-5">
          <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-3">Unread Mentions ({mentionedTasks.length})</h3>
          {mentionedTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No mentions</p>
          ) : (
            <div className="space-y-2">
              {mentionedTasks.slice(0, 5).map(t => (
                <div key={t.id} className="bg-[var(--card)] rounded-lg p-3">
                  <div className="text-[13px] font-medium">{t.title}</div>
                  <div className="text-[11px] text-[var(--text-dim)] line-clamp-1 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-[var(--border)]">
          <button onClick={() => { onOpenChat(); onClose(); }} className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">
            💬 Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
