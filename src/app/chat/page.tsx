"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { useWorkspaceData, supabase } from "@/lib/supabase/hooks";
import type { Agent } from "@/lib/data";
import type { Message } from "@/lib/supabase/types";

export default function ChatPage() {
  const { agents, workspaceId, loading } = useWorkspaceData();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-select first agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0]);
    }
  }, [agents, selectedAgent]);

  // Load messages for selected agent
  const loadMessages = useCallback(async () => {
    if (!workspaceId || !selectedAgent) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("agent_id", selectedAgent.id)
      .eq("is_broadcast", false)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }, [workspaceId, selectedAgent]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!workspaceId || !selectedAgent) return;
    const channel = supabase
      .channel(`chat-${selectedAgent.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `agent_id=eq.${selectedAgent.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (!msg.is_broadcast) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, selectedAgent]);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !workspaceId || !selectedAgent || sending) return;
    setSending(true);
    await supabase.from("messages").insert({
      agent_id: selectedAgent.id,
      workspace_id: workspaceId,
      direction: "outbound",
      content: input.trim(),
      is_broadcast: false,
    });
    setInput("");
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

      <div className="flex-1 flex overflow-hidden">
        {/* Agent list - sidebar on desktop, horizontal scroll on mobile */}
        <div className="hidden md:block w-[260px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] overflow-y-auto">
          <h3 className="px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-dim)]">Agents</h3>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-[3px] ${
                selectedAgent?.id === a.id
                  ? "bg-[var(--card)] border-[var(--accent)]"
                  : "border-transparent hover:bg-[var(--card)]"
              }`}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: a.color + "22", color: a.color }}>
                {a.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{a.name}</div>
                <div className="text-[11px] text-[var(--text-dim)] truncate">{a.role}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Mobile agent selector */}
        <div className="md:hidden shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {agents.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgent(a)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 border transition ${
                  selectedAgent?.id === a.id
                    ? "bg-[var(--card)] border-[var(--accent)] font-semibold"
                    : "border-[var(--border)] text-[var(--text-dim)]"
                }`}
              >
                <span>{a.emoji}</span> {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedAgent ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: selectedAgent.color + "22", color: selectedAgent.color }}>
                  {selectedAgent.emoji}
                </div>
                <div>
                  <div className="text-sm font-semibold">{selectedAgent.name}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">{selectedAgent.role}</div>
                </div>
              </div>

              {/* Messages */}
              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-16 text-[var(--text-dim)]">
                    <div className="text-3xl mb-2">💬</div>
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                      msg.direction === "outbound"
                        ? "bg-[var(--accent)] text-black rounded-br-sm"
                        : "bg-[var(--card)] rounded-bl-sm"
                    }`}>
                      <div className="text-sm leading-relaxed">{msg.content}</div>
                      <div className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-black/50" : "text-[var(--text-dim)]"}`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="shrink-0 p-3 md:p-4 border-t border-[var(--border)] bg-[var(--surface)]">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
                    placeholder={`Message ${selectedAgent.name}...`}
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
              <div className="text-center">
                <div className="text-4xl mb-3">💬</div>
                <p>Select an agent to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
