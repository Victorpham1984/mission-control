"use client";
import { useState, useEffect, useRef } from "react";
import { agents, initialTasks, initialFeed, columns, colNames, colColors, type Task, type FeedItem, type Agent } from "@/lib/data";
import { initialMessages, type ChatMessage } from "@/lib/chat-data";
import { createClient } from "@/lib/supabase/client";
import AgentProfileModal from "@/components/AgentProfileModal";
import SquadChatModal from "@/components/SquadChatModal";
import BroadcastModal from "@/components/BroadcastModal";

const badgeClass: Record<string, string> = {
  lead: "bg-amber-500 text-black",
  spc: "bg-purple-500 text-white",
  int: "bg-blue-500 text-white",
};
const statusDot: Record<string, string> = {
  working: "bg-green-400 shadow-[0_0_6px_#4ade80]",
  idle: "bg-slate-400",
  error: "bg-red-400 shadow-[0_0_6px_#f87171]",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [feed, setFeed] = useState<FeedItem[]>(initialFeed);
  const [filter, setFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAgent, setNewAgent] = useState(agents[0].id);
  const [newTags, setNewTags] = useState("");

  // Phase 1 state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [profileAgent, setProfileAgent] = useState<Agent | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages);
  const [user, setUser] = useState<{ email?: string; name: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        });
      }
    });
  }, [supabase.auth]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const moveTask = (id: number, status: Task["status"]) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, time: "Vừa xong" } : t));
    const t = tasks.find(x => x.id === id);
    const a = agents.find(x => x.id === t?.agent);
    setFeed(prev => [{ icon: status === "done" ? "✅" : "🔄", text: `${a?.name} → "${t?.title}" → ${colNames[status]}`, time: "Vừa xong", task: t?.title }, ...prev]);
    setModalTask(null);
  };

  const createTask = () => {
    if (!newTitle.trim()) return;
    const id = Math.max(...tasks.map(t => t.id)) + 1;
    const t: Task = { id, title: newTitle, desc: newDesc, agent: newAgent, status: "inbox", tags: newTags.split(",").map(s => s.trim()).filter(Boolean), time: "Vừa tạo" };
    setTasks(prev => [...prev, t]);
    const a = agents.find(x => x.id === newAgent);
    setFeed(prev => [{ icon: "📌", text: `Sếp Victor tạo: "${newTitle}" → ${a?.name}`, time: "Vừa xong", task: newTitle }, ...prev]);
    setNewTitle(""); setNewDesc(""); setNewTags(""); setShowNew(false);
  };

  const handleChatSend = (content: string) => {
    const msg: ChatMessage = {
      id: chatMessages.length + 1,
      sender: "Sếp Victor",
      emoji: "👑",
      content,
      time: "Vừa xong",
    };
    setChatMessages(prev => [...prev, msg]);
  };

  const handleBroadcast = (title: string, message: string, urgent: boolean) => {
    const prefix = urgent ? "🚨 URGENT" : "📢 BROADCAST";
    const content = title ? `**${prefix}: ${title}** — ${message}` : `**${prefix}:** ${message}`;
    const chatMsg: ChatMessage = {
      id: chatMessages.length + 1,
      sender: "Sếp Victor",
      emoji: "👑",
      content,
      time: "Vừa xong",
      isSystem: true,
    };
    setChatMessages(prev => [...prev, chatMsg]);
    setFeed(prev => [{
      icon: urgent ? "🚨" : "📢",
      text: title ? `Sếp Victor broadcast: ${title} — ${message}` : `Sếp Victor broadcast: ${message}`,
      time: "Vừa xong",
    }, ...prev]);
  };

  const visibleCols = filter === "all" ? columns : [filter];
  const filteredTasks = (col: string) => {
    let t = tasks.filter(x => x.status === col);
    if (selectedAgent) t = t.filter(x => x.agent === selectedAgent);
    return t;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 md:px-6 gap-3 md:gap-6 z-30">
        {/* Hamburger - mobile only */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-xl p-1">☰</button>

        <div className="text-base md:text-lg font-bold text-[var(--accent)] flex items-center gap-2 shrink-0">
          <span className="text-xl md:text-2xl">⚡</span>
          <span className="hidden sm:inline">CommandMate</span>
          <span className="sm:hidden">CM</span>
        </div>

        <div className="hidden md:flex gap-8 ml-8">
          <div className="text-center"><div className="text-3xl font-bold">{agents.filter(a => a.status === "working").length}</div><div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Agents</div></div>
          <div className="text-center"><div className="text-3xl font-bold">{tasks.length}</div><div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Tasks</div></div>
        </div>

        <div className="ml-auto flex gap-1.5 md:gap-2">
          <button onClick={() => setShowChat(true)} className="px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs md:text-sm hover:bg-[var(--card-hover)] transition" title="Squad Chat">
            💬 <span className="hidden sm:inline">Chat</span>
          </button>
          <button onClick={() => setShowBroadcast(true)} className="px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs md:text-sm hover:bg-[var(--card-hover)] transition" title="Broadcast">
            📢 <span className="hidden sm:inline">Broadcast</span>
          </button>
          <button className="hidden sm:block px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:bg-[var(--card-hover)] transition" title="Docs">
            📄 Docs
          </button>
          <button onClick={() => setShowNew(true)} className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg bg-[var(--accent)] text-black text-xs md:text-sm font-semibold hover:brightness-110 transition">
            + <span className="hidden sm:inline">New Task</span>
          </button>
          {/* User Menu */}
          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-[var(--accent)] text-black font-bold text-sm flex items-center justify-center hover:brightness-110 transition"
                title={user.email}
              >
                {user.name.charAt(0).toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 animate-modal overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <div className="text-sm font-semibold truncate">{user.name}</div>
                    <div className="text-xs text-[var(--text-dim)] truncate">{user.email}</div>
                  </div>
                  <a href="/settings" className="block px-4 py-2.5 text-sm hover:bg-[var(--card)] transition">⚙️ Settings</a>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card)] transition text-red-400">🚪 Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar overlay on mobile */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`absolute md:relative z-40 md:z-auto w-[260px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] overflow-y-auto py-4 h-full transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <h3 className="px-4 pb-3 text-xs uppercase tracking-widest text-[var(--text-dim)] flex justify-between">
            Agents <span className="bg-[var(--card)] px-2 rounded-full text-[11px]">{agents.length}</span>
          </h3>
          {agents.map(a => (
            <div key={a.id}
              onClick={() => {
                setProfileAgent(a);
                setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition border-l-[3px] ${selectedAgent === a.id ? "bg-[var(--card)] border-[var(--accent)]" : "border-transparent hover:bg-[var(--card)]"}`}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: a.color + "22", color: a.color }}>{a.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1.5">{a.name} <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeClass[a.badge]}`}>{a.badge}</span></div>
                <div className="text-[11px] text-[var(--text-dim)] truncate">{a.role}</div>
              </div>
              <div className={`w-2 h-2 rounded-full ${statusDot[a.status]}`} />
            </div>
          ))}
          {/* Agent filter clear */}
          {selectedAgent && (
            <div className="px-4 pt-3">
              <button onClick={() => setSelectedAgent(null)} className="w-full py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-dim)] hover:bg-[var(--card)] transition">
                ✕ Clear Filter
              </button>
            </div>
          )}
        </aside>

        {/* Kanban */}
        <main className="flex-1 overflow-auto p-3 md:p-4 flex flex-col gap-3 min-w-0">
          <div className="flex gap-1.5 flex-wrap">
            {[{ key: "all", label: "All" }, ...columns.map(c => ({ key: c, label: colNames[c] }))].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 md:px-3.5 py-1.5 rounded-full text-xs border transition ${filter === f.key ? "bg-[var(--accent)] text-black border-[var(--accent)] font-semibold" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
                {f.key !== "all" && "● "}{f.label} <span className="opacity-70 ml-1">{f.key === "all" ? tasks.length : tasks.filter(t => t.status === f.key).length}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 md:gap-4 flex-1 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none">
            {visibleCols.map(col => (
              <div key={col} className="min-w-[240px] md:min-w-[260px] w-[240px] md:w-[260px] shrink-0 flex flex-col snap-start">
                <div className="flex items-center gap-2 py-2 px-1 mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  <div className="w-2 h-2 rounded-full" style={{ background: colColors[col] }} />
                  {colNames[col]}
                  <span className="ml-auto bg-[var(--card)] px-2 rounded-full text-[11px]">{filteredTasks(col).length}</span>
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                  {filteredTasks(col).map(t => {
                    const a = agents.find(x => x.id === t.agent);
                    return (
                      <div key={t.id} onClick={() => setModalTask(t)} className="bg-[var(--card)] rounded-xl p-3 md:p-3.5 cursor-pointer transition border border-transparent hover:bg-[var(--card-hover)] hover:border-[var(--border)] hover:-translate-y-0.5">
                        <div className="text-[13px] font-semibold mb-1.5 leading-snug">{t.title}</div>
                        <div className="text-[11px] text-[var(--text-dim)] leading-snug mb-2 line-clamp-2">{t.desc}</div>
                        {t.tags.length > 0 && <div className="flex gap-1 flex-wrap mb-2">{t.tags.map(tag => <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{tag}</span>)}</div>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: a?.color }} />{a?.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">{t.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Live Feed - desktop always visible, mobile toggle */}
        <button onClick={() => setShowFeed(!showFeed)} className="md:hidden fixed bottom-4 right-4 z-20 w-12 h-12 rounded-full bg-[var(--card)] border border-[var(--border)] text-lg shadow-lg flex items-center justify-center">
          {showFeed ? "✕" : "📡"}
        </button>

        <aside className={`${showFeed ? "fixed inset-x-0 bottom-0 h-[60vh] z-30 rounded-t-2xl" : "hidden"} md:relative md:block md:h-auto md:rounded-none w-full md:w-[300px] shrink-0 bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-4`}>
          <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" /> LIVE
            <button onClick={() => setShowFeed(false)} className="md:hidden ml-auto text-[var(--text-dim)]">✕</button>
          </h3>
          {feed.map((f, i) => (
            <div key={i} className="py-3 border-b border-[var(--border)] last:border-0">
              <div className="text-xs leading-relaxed"><span className="mr-1.5">{f.icon}</span>{f.text}</div>
              <div className="text-[10px] text-[var(--text-dim)] mt-1">{f.time}</div>
              {f.task && <div className="inline-block mt-1.5 text-[11px] px-2 py-0.5 bg-[var(--card)] rounded-md text-[var(--accent-light)] cursor-pointer">📋 {f.task}</div>}
            </div>
          ))}
        </aside>
      </div>

      {/* Task Modal */}
      {modalTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalTask(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[600px] max-h-[80vh] overflow-y-auto border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h2 className="text-base font-semibold">● Task Detail <span className="text-xs text-[var(--text-dim)] font-normal">ID-{modalTask.id}</span></h2>
              <button onClick={() => setModalTask(null)} className="text-[var(--text-dim)] hover:text-white px-2 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Title</div><div className="text-base font-semibold">{modalTask.title}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Status</div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: colColors[modalTask.status] + "22", color: colColors[modalTask.status] }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: colColors[modalTask.status] }} /> {colNames[modalTask.status]}
                </span>
              </div>
              <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Agent</div>
                {(() => { const a = agents.find(x => x.id === modalTask.agent); return a ? <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: a.color + "22", color: a.color }}>{a.emoji}</div>{a.name}</div> : null; })()}
              </div>
              <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Description</div><div className="text-sm">{modalTask.desc}</div></div>
              {modalTask.tags.length > 0 && <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Tags</div><div className="flex gap-1">{modalTask.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{t}</span>)}</div></div>}
              {modalTask.result && <div><div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Result</div><pre className="bg-[var(--card)] p-3 rounded-lg text-xs whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">{modalTask.result}</pre></div>}
              <div className="flex gap-2 pt-2 flex-wrap">
                {modalTask.status !== "done" ? columns.filter(c => c !== modalTask.status).map(c => (
                  <button key={c} onClick={() => moveTask(modalTask.id, c as Task["status"])} className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs hover:bg-[var(--card-hover)] transition">→ {colNames[c]}</button>
                )) : <span className="text-green-400 text-sm">✅ Completed</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-[500px] border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h2 className="text-base font-semibold">+ New Task</h2>
              <button onClick={() => setShowNew(false)} className="text-[var(--text-dim)] hover:text-white px-2 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Title</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)]" placeholder="e.g. Viết copy landing page" /></div>
              <div><label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm resize-y focus:outline-none focus:border-[var(--accent)]" placeholder="Mô tả chi tiết..." /></div>
              <div><label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Assign to</label>
                <select value={newAgent} onChange={e => setNewAgent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm">
                  {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
                </select></div>
              <div><label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1">Tags (comma separated)</label>
                <input value={newTags} onChange={e => setNewTags(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)]" placeholder="e.g. content, landing-page" /></div>
              <button onClick={createTask} className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition">Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Profile Modal */}
      {profileAgent && (
        <AgentProfileModal
          agent={profileAgent}
          tasks={tasks}
          onClose={() => setProfileAgent(null)}
          onOpenChat={() => setShowChat(true)}
        />
      )}

      {/* Squad Chat Modal */}
      {showChat && (
        <SquadChatModal
          messages={chatMessages}
          onSend={handleChatSend}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <BroadcastModal
          onBroadcast={handleBroadcast}
          onClose={() => setShowBroadcast(false)}
        />
      )}
    </div>
  );
}
