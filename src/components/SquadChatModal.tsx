"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase, getWorkspaceId } from "@/lib/supabase/hooks";
import type { Message, Agent as DbAgent } from "@/lib/supabase/types";

type Props = {
  onClose: () => void;
};

const agentColors = [
  "#60a5fa", "#4ade80", "#f472b6", "#fb923c", "#a78bfa",
  "#34d399", "#f87171", "#facc15", "#38bdf8", "#c084fc",
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h trước`;
  return d.toLocaleDateString("vi-VN", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SquadChatModal({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<DbAgent[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const colorMap = useRef(new Map<string, string>());

  const loadData = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }

    const [msgsRes, agentsRes] = await Promise.all([
      supabase.from("messages").select("*").eq("workspace_id", wsId).order("created_at", { ascending: true }).limit(200),
      supabase.from("agents").select("*").eq("workspace_id", wsId),
    ]);

    const a = agentsRes.data || [];
    a.forEach((agent, i) => { if (!colorMap.current.has(agent.id)) colorMap.current.set(agent.id, agentColors[i % agentColors.length]); });
    setAgents(a);
    setMessages(msgsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("squad-chat-modal")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const getAgent = (agentId: string) => agents.find(a => a.id === agentId);

  const handleSend = async () => {
    if (!input.trim()) return;
    const wsId = await getWorkspaceId();
    if (!wsId || agents.length === 0) return;
    // Find Đệ or first agent
    const de = agents.find(a => a.name?.includes("Đệ")) || agents[0];
    await supabase.from("messages").insert({
      agent_id: de.id,
      workspace_id: wsId,
      direction: "inbound",
      content: input.trim(),
    });
    setInput("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[560px] h-[80vh] max-h-[600px] flex flex-col border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="text-base font-semibold">Squad Chat</h2>
            <span className="text-[11px] text-[var(--text-dim)] bg-[var(--card)] px-2 py-0.5 rounded-full">{messages.length} messages</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl px-2">×</button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-12 text-[var(--text-dim)] text-sm">Chưa có tin nhắn nào trong Squad Chat</div>
          )}
          {messages.map(msg => {
            const agent = getAgent(msg.agent_id);
            const color = colorMap.current.get(msg.agent_id) || "#888";
            const isSystem = msg.direction === "inbound";
            return (
              <div key={msg.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: color + "22", color }}>
                  {agent?.avatar_emoji || "🤖"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold" style={{ color }}>{agent?.name || "Unknown"}</span>
                    {agent?.role && <span className="text-[10px] text-[var(--text-dim)]">{agent.role}</span>}
                    <span className="text-[10px] text-[var(--text-dim)]">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className={`text-sm leading-relaxed ${isSystem ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg p-2.5" : "text-[var(--text)]"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)] shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
              placeholder="Gửi tin nhắn cho Squad..."
            />
            <button onClick={handleSend} className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition shrink-0">
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
