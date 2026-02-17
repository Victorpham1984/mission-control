"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { invokeOpenClaw, sendAgentMessage } from "@/lib/openclaw";
import type { Session, Message } from "@/lib/openclaw";

function SkeletonLine({ w = "w-full" }: { w?: string }) {
  return <div className={`h-4 ${w} bg-[var(--card)] rounded animate-pulse`} />;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [thinkOpen, setThinkOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--accent)] text-black rounded-br-md"
            : "bg-[var(--card)] text-[var(--text)] rounded-bl-md border border-[var(--border)]"
        }`}
      >
        {msg.thinking && (
          <button
            onClick={() => setThinkOpen(!thinkOpen)}
            className="text-xs opacity-60 hover:opacity-100 mb-1 flex items-center gap-1"
          >
            {thinkOpen ? "▼" : "▶"} Thinking
          </button>
        )}
        {thinkOpen && msg.thinking && (
          <pre className="text-xs opacity-50 whitespace-pre-wrap mb-2 border-l-2 border-current pl-2">
            {msg.thinking}
          </pre>
        )}
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        {msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
          <>
            <button
              onClick={() => setToolOpen(!toolOpen)}
              className="text-xs opacity-60 hover:opacity-100 mt-1 flex items-center gap-1"
            >
              {toolOpen ? "▼" : "▶"} {msg.toolCalls.length} tool call(s)
            </button>
            {toolOpen && (
              <pre className="text-xs opacity-50 whitespace-pre-wrap mt-1 bg-black/20 rounded p-2 overflow-auto max-h-40">
                {JSON.stringify(msg.toolCalls, null, 2)}
              </pre>
            )}
          </>
        )}
        {msg.timestamp && (
          <div className="text-[10px] opacity-40 mt-1">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchSessions = useCallback(async () => {
    try {
      const data = await invokeOpenClaw("session_status", "list");
      const list = data?.sessions || data?.result?.sessions || [];
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (key: string) => {
    setMsgLoading(true);
    try {
      const data = await invokeOpenClaw("session_status", "history", { sessionKey: key });
      const msgs = data?.messages || data?.result?.messages || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    if (selected) {
      fetchMessages(selected);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selected, fetchMessages]);

  useEffect(() => { scrollBottom(); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);

    // Optimistic add
    setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: new Date().toISOString() }]);

    try {
      await sendAgentMessage(msg, selected || undefined);
    } catch {
      /* ignore */
    }

    // Start polling for response
    let polls = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      polls++;
      if (selected) {
        await fetchMessages(selected);
      }
      if (polls > 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        setSending(false);
      }
    }, 3000);

    setTimeout(() => setSending(false), 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed bottom-20 left-3 z-40 w-10 h-10 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg"
        >
          💬
        </button>

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:relative z-30 w-72 h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-transform`}
        >
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-dim)] uppercase tracking-wider">Sessions</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <SkeletonLine w="w-3/4" />
                    <SkeletonLine w="w-1/2" />
                  </div>
                ))
              : sessions.length === 0
              ? (
                <div className="p-6 text-center text-[var(--text-dim)] text-sm">
                  <div className="text-3xl mb-2">📭</div>
                  No sessions found
                </div>
              )
              : sessions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { setSelected(s.key); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition hover:bg-[var(--card-hover)] ${
                      selected === s.key ? "bg-[var(--card)] border-l-2 border-l-[var(--accent)]" : ""
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{s.label || s.key}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-0.5 truncate">{s.model || "—"}</div>
                  </button>
                ))}
          </div>
        </div>

        {/* Main chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
              <div className="text-center">
                <div className="text-5xl mb-4">💬</div>
                <div className="text-lg font-medium">Live Agent Chat</div>
                <div className="text-sm mt-1">Select a session to start chatting</div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
                <div className="text-sm font-semibold">{sessions.find(s => s.key === selected)?.label || selected}</div>
                <div className="text-xs text-[var(--text-dim)]">{selected}</div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                {msgLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                        <div className="w-48 h-12 bg-[var(--card)] rounded-2xl animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
                    <div className="text-center">
                      <div className="text-3xl mb-2">🗨️</div>
                      No messages yet. Say hello!
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
                )}
                {sending && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[var(--text-dim)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-[var(--text-dim)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-[var(--text-dim)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-2 md:p-3 border-t border-[var(--border)] bg-[var(--surface)] sticky bottom-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="px-3 py-2 md:px-4 md:py-2.5 bg-[var(--accent)] text-black rounded-xl font-medium text-xs md:text-sm hover:brightness-110 transition disabled:opacity-50"
                  >
                    <span className="hidden md:inline">Send</span>
                    <span className="md:hidden">➤</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
