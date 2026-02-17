"use client";
import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { useWorkspaceData, supabase } from "@/lib/supabase/hooks";
import type { Message } from "@/lib/supabase/types";

type Priority = "normal" | "high" | "urgent";

const priorityColors: Record<Priority, string> = {
  normal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

const priorityLabels: Record<Priority, string> = {
  normal: "Normal",
  high: "High",
  urgent: "🚨 Urgent",
};

export default function BroadcastPage() {
  const { agents, workspaceId, loading } = useWorkspaceData();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<(Message & { _agentCount?: number })[]>([]);

  const loadHistory = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_broadcast", true)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      // Deduplicate by content+created_at (broadcasts create one per agent)
      const seen = new Map<string, Message & { _agentCount?: number }>();
      for (const msg of data) {
        const key = `${msg.content}::${msg.created_at}`;
        if (seen.has(key)) {
          seen.get(key)!._agentCount = (seen.get(key)!._agentCount || 1) + 1;
        } else {
          seen.set(key, { ...msg, _agentCount: 1 });
        }
      }
      setHistory(Array.from(seen.values()));
    }
  }, [workspaceId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSend = async () => {
    if (!message.trim() || !workspaceId || sending || agents.length === 0) return;
    setSending(true);

    const content = title.trim()
      ? `[${priority.toUpperCase()}] ${title.trim()}: ${message.trim()}`
      : `[${priority.toUpperCase()}] ${message.trim()}`;

    const inserts = agents.map(a => ({
      agent_id: a.id,
      workspace_id: workspaceId,
      direction: "outbound" as const,
      content,
      is_broadcast: true,
      metadata: { title: title.trim(), priority },
    }));

    await supabase.from("messages").insert(inserts);

    setTitle("");
    setMessage("");
    setPriority("normal");
    setSending(false);
    await loadHistory();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const extractPriority = (content: string): Priority => {
    if (content.startsWith("[URGENT]")) return "urgent";
    if (content.startsWith("[HIGH]")) return "high";
    return "normal";
  };

  const extractBody = (content: string): string => {
    return content.replace(/^\[(NORMAL|HIGH|URGENT)\]\s*/, "");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📢</div>
          <div className="text-[var(--text-dim)] text-sm">Loading broadcast...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Broadcast Form */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">📢</span>
              <h1 className="text-lg font-bold">Broadcast to Squad</h1>
              <span className="text-xs text-[var(--text-dim)] bg-[var(--card)] px-2 py-0.5 rounded-full">{agents.length} agents</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Title (optional)</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. System Update"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Message *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-y focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Write your announcement..."
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-2">Priority</label>
                <div className="flex gap-2">
                  {(["normal", "high", "urgent"] as Priority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        priority === p
                          ? priorityColors[p]
                          : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"
                      }`}
                    >
                      {priorityLabels[p]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || agents.length === 0}
                className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "📢 Broadcast to All Agents"}
              </button>
            </div>
          </div>

          {/* Broadcast History */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">Broadcast History</h2>
            {history.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-dim)] bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
                <div className="text-3xl mb-2">📡</div>
                <p className="text-sm">No broadcasts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(msg => {
                  const p = extractPriority(msg.content);
                  const body = extractBody(msg.content);
                  return (
                    <div key={msg.id} className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityColors[p]}`}>
                            {priorityLabels[p]}
                          </span>
                          <span className="text-[11px] text-[var(--text-dim)]">
                            → {msg._agentCount || 1} agent{(msg._agentCount || 1) > 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-dim)] shrink-0">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className="text-sm leading-relaxed">{body}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
