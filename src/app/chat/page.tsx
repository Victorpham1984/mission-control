"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { useWorkspaceData, supabase } from "@/lib/supabase/hooks";
import type { Message, Agent as DbAgent } from "@/lib/supabase/types";

// Color palette for agents
const agentColors = [
  "#60a5fa", "#4ade80", "#f472b6", "#fb923c", "#a78bfa",
  "#34d399", "#f87171", "#facc15", "#38bdf8", "#c084fc",
];

function getAgentColor(index: number): string {
  return agentColors[index % agentColors.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { dbAgents, workspaceId, loading } = useWorkspaceData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Agent color map
  const agentColorMap = useRef(new Map<string, string>());
  useEffect(() => {
    dbAgents.forEach((a, i) => {
      if (!agentColorMap.current.has(a.id)) {
        agentColorMap.current.set(a.id, getAgentColor(i));
      }
    });
  }, [dbAgents]);

  // Load all messages
  const loadMessages = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data);
  }, [workspaceId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel("squad-chat")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload: { new: Message; old?: Message }) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const getAgent = (agentId: string): DbAgent | undefined => dbAgents.find(a => a.id === agentId);

  const handleSend = async () => {
    if (!input.trim() || !workspaceId || sending) return;
    setSending(true);
    // Send as first agent (in real app would pick based on context)
    const agentId = dbAgents[0]?.id;
    if (agentId) {
      await supabase.from("messages").insert({
        agent_id: agentId,
        workspace_id: workspaceId,
        direction: "outbound",
        content: input.trim(),
        is_broadcast: false,
      });
    }
    setInput("");
    setSending(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💬</div>
          <div className="text-[var(--text-dim)] text-sm">Loading chat...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat header */}
        <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏠</span>
            <div>
              <div className="text-sm font-semibold">Squad Chat</div>
              <div className="text-[11px] text-[var(--text-dim)]">{dbAgents.length} agents · All messages</div>
            </div>
            {/* Agent avatars */}
            <div className="ml-auto flex -space-x-2">
              {dbAgents.slice(0, 5).map((a, i) => (
                <div key={a.id} className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-[var(--surface)]" style={{ background: getAgentColor(i) + "33" }}>
                  {a.avatar_emoji || "🤖"}
                </div>
              ))}
              {dbAgents.length > 5 && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] bg-[var(--card)] border-2 border-[var(--surface)] text-[var(--text-dim)]">
                  +{dbAgents.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16 text-[var(--text-dim)]">
              <div className="text-3xl mb-2">🏠</div>
              <p className="text-sm">Squad chat is empty. Send the first message!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const agent = getAgent(msg.agent_id);
            const color = agentColorMap.current.get(msg.agent_id) || "#60a5fa";
            const emoji = agent?.avatar_emoji || "🤖";
            const name = agent?.name || "Agent";
            const isOutbound = msg.direction === "outbound";

            // Group consecutive messages from same agent
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showHeader = !prevMsg || prevMsg.agent_id !== msg.agent_id || prevMsg.direction !== msg.direction;

            return (
              <div key={msg.id} className={`${showHeader ? "mt-3" : "mt-0.5"}`}>
                {showHeader && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{emoji}</span>
                    <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                    {isOutbound && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--text-dim)]">outbound</span>}
                    <span className="text-[10px] text-[var(--text-dim)] ml-auto">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <div className="ml-7">
                  <div className="inline-block rounded-xl px-3.5 py-2 text-sm leading-relaxed" style={{ background: color + "12", borderLeft: `3px solid ${color}33` }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 md:p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
              placeholder="Message the squad... (Enter to send)"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition shrink-0 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
