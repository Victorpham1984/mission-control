"use client";
import { useState } from "react";
import { agents, initialTasks, initialFeed, columns, colNames, colColors, type Task, type FeedItem } from "@/lib/data";

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

  const visibleCols = filter === "all" ? columns : [filter];
  const filteredTasks = (col: string) => {
    let t = tasks.filter(x => x.status === col);
    if (selectedAgent) t = t.filter(x => x.agent === selectedAgent);
    return t;
  };

  return (
    <div className="h-screen grid grid-cols-[260px_1fr_300px] grid-rows-[64px_1fr] overflow-hidden">
      {/* Header */}
      <header className="col-span-3 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-6 gap-6">
        <div className="text-lg font-bold text-[var(--accent)] flex items-center gap-2"><span className="text-2xl">🐾</span> ĐỆ MISSION CONTROL</div>
        <div className="flex gap-8 ml-8">
          <div className="text-center"><div className="text-3xl font-bold">{agents.filter(a => a.status === "working").length}</div><div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Agents</div></div>
          <div className="text-center"><div className="text-3xl font-bold">{tasks.length}</div><div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Tasks</div></div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold">● Active</button>
          <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:bg-[var(--card-hover)] transition">+ New Task</button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="bg-[var(--surface)] border-r border-[var(--border)] overflow-y-auto py-4">
        <h3 className="px-4 pb-3 text-xs uppercase tracking-widest text-[var(--text-dim)] flex justify-between">Agents <span className="bg-[var(--card)] px-2 rounded-full text-[11px]">{agents.length}</span></h3>
        {agents.map(a => (
          <div key={a.id} onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition border-l-[3px] ${selectedAgent === a.id ? "bg-[var(--card)] border-[var(--accent)]" : "border-transparent hover:bg-[var(--card)]"}`}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: a.color + "22", color: a.color }}>{a.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">{a.name} <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeClass[a.badge]}`}>{a.badge}</span></div>
              <div className="text-[11px] text-[var(--text-dim)] truncate">{a.role}</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${statusDot[a.status]}`} />
          </div>
        ))}
      </aside>

      {/* Kanban */}
      <main className="overflow-auto p-4 flex flex-col gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {[{ key: "all", label: "All" }, ...columns.map(c => ({ key: c, label: colNames[c] }))].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs border transition ${filter === f.key ? "bg-[var(--accent)] text-black border-[var(--accent)] font-semibold" : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--card)]"}`}>
              {f.key !== "all" && "● "}{f.label} <span className="opacity-70 ml-1">{f.key === "all" ? tasks.length : tasks.filter(t => t.status === f.key).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-4 flex-1 overflow-x-auto pb-2">
          {visibleCols.map(col => (
            <div key={col} className="min-w-[260px] w-[260px] shrink-0 flex flex-col">
              <div className="flex items-center gap-2 py-2 px-1 mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                <div className="w-2 h-2 rounded-full" style={{ background: colColors[col] }} />
                {colNames[col]}
                <span className="ml-auto bg-[var(--card)] px-2 rounded-full text-[11px]">{filteredTasks(col).length}</span>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {filteredTasks(col).map(t => {
                  const a = agents.find(x => x.id === t.agent);
                  return (
                    <div key={t.id} onClick={() => setModalTask(t)} className="bg-[var(--card)] rounded-xl p-3.5 cursor-pointer transition border border-transparent hover:bg-[var(--card-hover)] hover:border-[var(--border)] hover:-translate-y-0.5">
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

      {/* Live Feed */}
      <aside className="bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-4">
        <h3 className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" /> LIVE
        </h3>
        {feed.map((f, i) => (
          <div key={i} className="py-3 border-b border-[var(--border)] last:border-0">
            <div className="text-xs leading-relaxed"><span className="mr-1.5">{f.icon}</span>{f.text}</div>
            <div className="text-[10px] text-[var(--text-dim)] mt-1">{f.time}</div>
            {f.task && <div className="inline-block mt-1.5 text-[11px] px-2 py-0.5 bg-[var(--card)] rounded-md text-[var(--accent-light)] cursor-pointer">📋 {f.task}</div>}
          </div>
        ))}
      </aside>

      {/* Task Modal */}
      {modalTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setModalTask(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-[600px] max-h-[80vh] overflow-y-auto border border-[var(--border)]" onClick={e => e.stopPropagation()}>
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
              <div className="flex gap-2 pt-2">
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-[500px] border border-[var(--border)]" onClick={e => e.stopPropagation()}>
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

      {/* FAB */}
      <button onClick={() => setShowNew(true)} className="fixed bottom-6 right-[324px] w-12 h-12 rounded-full bg-[var(--accent)] text-black text-2xl shadow-lg hover:scale-110 transition z-40">+</button>
    </div>
  );
}
