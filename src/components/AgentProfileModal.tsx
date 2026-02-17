"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { type Agent, type Task, colNames, colColors } from "@/lib/data";
import type { Agent as DbAgent, Message, Task as DbTask } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/hooks";

const statusLabel: Record<string, string> = { working: "🟢 Working", idle: "⚪ Idle", error: "🔴 Error" };
const statusColors: Record<string, string> = { working: "#4ade80", idle: "#94a3b8", error: "#f87171" };

type Props = {
  agent: Agent;
  dbAgent?: DbAgent;
  tasks: Task[];
  onClose: () => void;
  onOpenChat: () => void;
  onTaskClick?: (task: Task) => void;
};

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentProfileModal({ agent, dbAgent, tasks, onClose, onOpenChat, onTaskClick }: Props) {
  const [tab, setTab] = useState<"attention" | "timeline" | "messages">("attention");
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);

  // Editable fields
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(agent.name);
  const [editingRole, setEditingRole] = useState(false);
  const [roleVal, setRoleVal] = useState(dbAgent?.role || agent.role || "");
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutVal, setAboutVal] = useState(dbAgent?.about || "");
  const [editingSkills, setEditingSkills] = useState(false);
  const [skillsVal, setSkillsVal] = useState((dbAgent?.skills || []).join(", "));
  const [skills, setSkills] = useState<string[]>(dbAgent?.skills || []);

  const nameRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const aboutRef = useRef<HTMLTextAreaElement>(null);
  const skillsRef = useRef<HTMLInputElement>(null);

  const allTasks = tasks.filter(t => t.agent === agent.id);
  const pendingTasks = allTasks.filter(t => t.status !== "done");
  const emoji = dbAgent?.avatar_emoji || agent.emoji;

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!dbAgent) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("agent_id", dbAgent.id)
      .eq("workspace_id", dbAgent.workspace_id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  }, [dbAgent]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime messages
  useEffect(() => {
    if (!dbAgent) return;
    const channel = supabase
      .channel(`agent-msgs-${dbAgent.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `agent_id=eq.${dbAgent.id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dbAgent]);

  const saveField = async (field: string, value: unknown) => {
    if (!dbAgent) return;
    await supabase.from("agents").update({ [field]: value }).eq("id", dbAgent.id);
  };

  const handleNameSave = async () => {
    setEditingName(false);
    if (nameVal.trim() && nameVal !== agent.name) {
      await saveField("name", nameVal.trim());
    } else {
      setNameVal(agent.name);
    }
  };

  const handleRoleSave = async () => {
    setEditingRole(false);
    await saveField("role", roleVal.trim());
  };

  const handleAboutSave = async () => {
    setEditingAbout(false);
    await saveField("about", aboutVal.trim());
  };

  const handleSkillsSave = async () => {
    setEditingSkills(false);
    const parsed = skillsVal.split(",").map(s => s.trim()).filter(Boolean);
    setSkills(parsed);
    await saveField("skills", parsed);
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !dbAgent || sending) return;
    setSending(true);
    await supabase.from("messages").insert({
      agent_id: dbAgent.id,
      workspace_id: dbAgent.workspace_id,
      direction: "outbound",
      content: msgInput.trim(),
      is_broadcast: false,
    });
    setMsgInput("");
    setSending(false);
  };

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingRole && roleRef.current) roleRef.current.focus();
  }, [editingRole]);
  useEffect(() => {
    if (editingAbout && aboutRef.current) aboutRef.current.focus();
  }, [editingAbout]);
  useEffect(() => {
    if (editingSkills && skillsRef.current) skillsRef.current.focus();
  }, [editingSkills]);

  const tabs = [
    { key: "attention" as const, label: "⚠️ Attention", count: pendingTasks.length },
    { key: "timeline" as const, label: "📋 Timeline", count: allTasks.length },
    { key: "messages" as const, label: "💬 Messages", count: messages.length },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-t-2xl md:rounded-2xl w-full max-w-[560px] max-h-[90vh] flex flex-col border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header - Avatar + Name + Role + Status */}
        <div className="p-5 md:p-6 text-center relative shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-white text-xl">×</button>
          
          <div className="text-5xl mb-3">{emoji}</div>
          
          {/* Editable Name */}
          {editingName ? (
            <input
              ref={nameRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => e.key === "Enter" && handleNameSave()}
              className="text-lg font-bold bg-transparent border-b-2 border-[var(--accent)] text-center outline-none w-48 mx-auto block"
            />
          ) : (
            <h2 className="text-lg font-bold cursor-pointer hover:text-[var(--accent)] transition" onClick={() => setEditingName(true)} title="Click to rename">
              {nameVal}
            </h2>
          )}

          {/* Editable Role */}
          {editingRole ? (
            <input
              ref={roleRef}
              value={roleVal}
              onChange={e => setRoleVal(e.target.value)}
              onBlur={handleRoleSave}
              onKeyDown={e => e.key === "Enter" && handleRoleSave()}
              className="text-sm text-[var(--text-dim)] bg-transparent border-b border-[var(--border)] text-center outline-none w-48 mx-auto block mt-1"
              placeholder="Add role..."
            />
          ) : (
            <p className="text-sm text-[var(--text-dim)] mt-1 cursor-pointer hover:text-[var(--accent)] transition" onClick={() => setEditingRole(true)}>
              {roleVal || "Click to add role"}
            </p>
          )}

          {/* Status Badge */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs" style={{ background: statusColors[agent.status] + "15", color: statusColors[agent.status] }}>
            <span className="w-2 h-2 rounded-full" style={{ background: statusColors[agent.status] }} />
            {statusLabel[agent.status]}
          </div>
        </div>

        {/* About Section */}
        <div className="px-5 pb-3 shrink-0">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">About</h3>
          {editingAbout ? (
            <textarea
              ref={aboutRef}
              value={aboutVal}
              onChange={e => setAboutVal(e.target.value)}
              onBlur={handleAboutSave}
              rows={2}
              className="w-full text-sm bg-[var(--card)] rounded-lg px-3 py-2 border border-[var(--border)] outline-none focus:border-[var(--accent)] resize-none"
              placeholder="Describe this agent..."
            />
          ) : (
            <p className="text-sm text-[var(--text-dim)] cursor-pointer hover:text-white transition rounded-lg px-3 py-2 hover:bg-[var(--card)]" onClick={() => setEditingAbout(true)}>
              {aboutVal || "Click to add description..."}
            </p>
          )}
        </div>

        {/* Skills Section */}
        <div className="px-5 pb-4 shrink-0">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">Skills</h3>
          {editingSkills ? (
            <input
              ref={skillsRef}
              value={skillsVal}
              onChange={e => setSkillsVal(e.target.value)}
              onBlur={handleSkillsSave}
              onKeyDown={e => e.key === "Enter" && handleSkillsSave()}
              className="w-full text-sm bg-[var(--card)] rounded-lg px-3 py-2 border border-[var(--border)] outline-none focus:border-[var(--accent)]"
              placeholder="React, TypeScript, Node.js..."
            />
          ) : (
            <div className="flex flex-wrap gap-1.5 cursor-pointer" onClick={() => { setEditingSkills(true); setSkillsVal(skills.join(", ")); }}>
              {skills.length > 0 ? skills.map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-dim)]">{s}</span>
              )) : (
                <span className="text-sm text-[var(--text-dim)] hover:text-white transition px-3 py-2 rounded-lg hover:bg-[var(--card)]">Click to add skills...</span>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] px-5 shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition border-b-2 ${
                tab === t.key ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--text-dim)] hover:text-white"
              }`}
            >
              {t.label} <span className="ml-1 opacity-60">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5">
          {tab === "attention" && (
            <div className="space-y-2">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-dim)]">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-sm">All clear! No pending tasks.</p>
                </div>
              ) : pendingTasks.map(t => (
                <div key={t.id} onClick={() => onTaskClick?.(t)} className="bg-[var(--card)] rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--card-hover)] transition">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colColors[t.status] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{colNames[t.status]} · {t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-2">
              {allTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-dim)]">
                  <div className="text-2xl mb-2">📋</div>
                  <p className="text-sm">No tasks yet.</p>
                </div>
              ) : allTasks.map(t => (
                <div key={t.id} onClick={() => onTaskClick?.(t)} className="bg-[var(--card)] rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--card-hover)] transition">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colColors[t.status] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{colNames[t.status]} · {t.time}</div>
                  </div>
                  {t.status === "done" && <span className="text-xs">✅</span>}
                </div>
              ))}
            </div>
          )}

          {tab === "messages" && (
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-dim)]">
                  <div className="text-2xl mb-2">💬</div>
                  <p className="text-sm">No messages yet.</p>
                </div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    m.direction === "outbound" ? "bg-[var(--accent)] text-black rounded-br-sm" : "bg-[var(--card)] rounded-bl-sm"
                  }`}>
                    <div className="text-sm">{m.content}</div>
                    <div className={`text-[10px] mt-0.5 ${m.direction === "outbound" ? "text-black/50" : "text-[var(--text-dim)]"}`}>
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Input */}
        <div className="shrink-0 p-4 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
              placeholder={`Send message to ${nameVal}...`}
              disabled={sending}
            />
            <button onClick={handleSendMessage} disabled={!msgInput.trim() || sending} className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
