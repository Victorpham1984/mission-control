"use client";
import { useState } from "react";

type Props = {
  onBroadcast: (title: string, message: string, urgent: boolean) => void;
  onClose: () => void;
};

export default function BroadcastModal({ onBroadcast, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [urgent, setUrgent] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onBroadcast(title.trim(), message.trim(), urgent);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[480px] border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📢</span>
            <h2 className="text-base font-semibold">Broadcast to Squad</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl px-2">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Title (optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)]" placeholder="e.g. System Update" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-y focus:outline-none focus:border-[var(--accent)]" placeholder="Nội dung broadcast..." />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-2">Priority</label>
            <div className="flex gap-2">
              <button onClick={() => setUrgent(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${!urgent ? "bg-[var(--card)] border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
                Normal
              </button>
              <button onClick={() => setUrgent(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${urgent ? "bg-red-500/20 border-red-400 text-red-400" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
                🚨 Urgent
              </button>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={!message.trim()} className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed">
            📢 Broadcast to Squad
          </button>
        </div>
      </div>
    </div>
  );
}
