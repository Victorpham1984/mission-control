"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import { invokeOpenClaw } from "@/lib/openclaw";
import type { Session, Message } from "@/lib/openclaw";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function SkeletonLine({ w = "w-full" }: { w?: string }) {
  return <div className={`h-4 ${w} bg-[var(--card)] rounded animate-pulse`} />;
}

function TokenBadge({ tokens }: { tokens?: number }) {
  if (!tokens) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--card-hover)] rounded text-[var(--text-dim)]">
      {tokens.toLocaleString()} tok
    </span>
  );
}

function TypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    main: "bg-[var(--green)]/20 text-[var(--green)]",
    subagent: "bg-[var(--purple)]/20 text-[var(--purple)]",
    cron: "bg-[var(--blue)]/20 text-[var(--blue)]",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[type] || "bg-[var(--card-hover)] text-[var(--text-dim)]"}`}>
      {type}
    </span>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
  useEffect(() => { if (selected) fetchMessages(selected); }, [selected, fetchMessages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    let list = sessions;
    if (typeFilter !== "all") list = list.filter((s) => s.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.key.toLowerCase().includes(q) ||
          (s.label || "").toLowerCase().includes(q) ||
          (s.model || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sessions, typeFilter, search]);

  const filteredMessages = useMemo(() => {
    if (!search) return messages;
    const q = search.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, search]);

  const exportMarkdown = () => {
    const session = sessions.find((s) => s.key === selected);
    const lines = [
      `# Session: ${session?.label || selected}`,
      `**Key:** ${selected}`,
      `**Model:** ${session?.model || "—"}`,
      `**Tokens:** ${session?.totalTokens?.toLocaleString() || "—"}`,
      "",
      "---",
      "",
    ];
    filteredMessages.forEach((m) => {
      lines.push(`### ${m.role.toUpperCase()}${m.timestamp ? ` (${new Date(m.timestamp).toLocaleString()})` : ""}`);
      lines.push("");
      lines.push(m.content);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${selected}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed bottom-20 left-3 z-40 w-10 h-10 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg"
        >
          📋
        </button>

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:relative z-30 w-80 h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-transform`}
        >
          <div className="p-4 border-b border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-dim)] uppercase tracking-wider">Sessions</h2>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-xs text-[var(--text-dim)] hover:text-white transition"
                title="⌘K to search"
              >
                🔍
              </button>
            </div>
            {searchOpen && (
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sessions... (⌘K)"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] transition animate-modal"
              />
            )}
            <div className="flex gap-1 overflow-x-auto">
              {["all", "main", "subagent", "cron"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`text-xs px-2 py-1 rounded-lg transition ${
                    typeFilter === t
                      ? "bg-[var(--accent)] text-black font-medium"
                      : "bg-[var(--card)] text-[var(--text-dim)] hover:bg-[var(--card-hover)]"
                  }`}
                >
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2 border-b border-[var(--border)]">
                    <SkeletonLine w="w-3/4" />
                    <SkeletonLine w="w-1/2" />
                  </div>
                ))
              : filtered.length === 0
              ? (
                <div className="p-6 text-center text-[var(--text-dim)] text-sm">
                  <div className="text-3xl mb-2">📭</div>
                  {search ? "No matching sessions" : "No sessions found"}
                </div>
              )
              : filtered.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { setSelected(s.key); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition hover:bg-[var(--card-hover)] ${
                      selected === s.key ? "bg-[var(--card)] border-l-2 border-l-[var(--accent)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">{s.label || s.key}</span>
                      <TypeBadge type={s.type} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--text-dim)] truncate flex-1">{s.model || "—"}</span>
                      <TokenBadge tokens={s.totalTokens} />
                    </div>
                    {s.lastUpdated && (
                      <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                        {new Date(s.lastUpdated).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
              <div className="text-center">
                <div className="text-5xl mb-4">📋</div>
                <div className="text-lg font-medium">Session Transcripts</div>
                <div className="text-sm mt-1">Select a session to view its transcript</div>
                <div className="text-xs mt-3 opacity-50">Press ⌘K to search</div>
              </div>
            </div>
          ) : (
            <>
              {/* Header bar */}
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {sessions.find((s) => s.key === selected)?.label || selected}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--text-dim)]">{selected}</span>
                    <TokenBadge tokens={sessions.find((s) => s.key === selected)?.totalTokens} />
                  </div>
                </div>
                <button
                  onClick={exportMarkdown}
                  className="px-2 md:px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs hover:bg-[var(--card-hover)] transition shrink-0"
                >
                  <span className="md:hidden">📥</span>
                  <span className="hidden md:inline">📥 Export MD</span>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
                {msgLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <SkeletonLine w="w-20" />
                        <SkeletonLine />
                        <SkeletonLine w="w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
                    <div className="text-center">
                      <div className="text-3xl mb-2">📝</div>
                      No messages in this session
                    </div>
                  </div>
                ) : (
                  filteredMessages.map((msg, i) => (
                    <div key={i} className="animate-modal">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold uppercase ${
                            msg.role === "user"
                              ? "text-[var(--accent)]"
                              : msg.role === "assistant"
                              ? "text-[var(--blue)]"
                              : "text-[var(--text-dim)]"
                          }`}
                        >
                          {msg.role}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[10px] text-[var(--text-dim)]">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        )}
                        {msg.tokens && <TokenBadge tokens={msg.tokens} />}
                      </div>
                      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
