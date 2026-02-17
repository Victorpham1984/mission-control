"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { type Task, type Agent, colNames, colColors } from "@/lib/data";
import type { Agent as DbAgent, TaskComment } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/hooks";

type Props = {
  task: Task;
  agents: Agent[];
  dbAgents: DbAgent[];
  workspaceId: string | null;
  onClose: () => void;
  onArchive?: (taskId: number | string) => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TaskDetailModal({ task, agents, dbAgents, workspaceId, onClose, onArchive }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const agent = agents.find(a => a.id === task.agent);

  const loadComments = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    if (data) setComments(data);
  }, [task.id, workspaceId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  // Realtime comments
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`task-comments-${task.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${task.id}` }, (payload) => {
        setComments(prev => [...prev, payload.new as TaskComment]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [task.id, workspaceId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleAddComment = async () => {
    if (!commentInput.trim() || !workspaceId || sending) return;
    setSending(true);
    // Use first agent as commenter (in real app, would be current user's agent)
    const agentId = task.agent || dbAgents[0]?.id;
    if (agentId) {
      await supabase.from("task_comments").insert({
        task_id: task.id,
        agent_id: agentId,
        workspace_id: workspaceId,
        content: commentInput.trim(),
      });
    }
    setCommentInput("");
    setSending(false);
  };

  const handleArchive = async () => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", task.id);
    onArchive?.(task.id);
    onClose();
  };

  const getAgentForComment = (agentId: string) => {
    const db = dbAgents.find(a => a.id === agentId);
    const ui = agents.find(a => a.id === agentId);
    return {
      emoji: db?.avatar_emoji || ui?.emoji || "🤖",
      name: db?.name || ui?.name || "Agent",
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-t-2xl md:rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col border border-[var(--border)] animate-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold mb-2">{task.title}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: colColors[task.status] + "22", color: colColors[task.status] }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: colColors[task.status] }} />
                  {colNames[task.status]}
                </span>
                {agent && (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                    <span>{agent.emoji}</span> {agent.name}
                  </span>
                )}
                <span className="text-xs text-[var(--text-dim)]">{task.time}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xl ml-2">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
          {/* Description */}
          {task.desc && <p className="text-sm text-[var(--text-dim)]">{task.desc}</p>}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {task.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--card)] text-[var(--text-dim)] border border-[var(--border)]">{t}</span>)}
            </div>
          )}

          {/* View Content (expandable) */}
          {task.result && (
            <div>
              <button onClick={() => setShowContent(!showContent)} className="text-xs text-[var(--accent)] hover:underline">
                {showContent ? "▾ Hide content" : "▸ View content"}
              </button>
              {showContent && (
                <pre className="mt-2 bg-[var(--card)] p-3 rounded-lg text-xs whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto border border-[var(--border)]">
                  {task.result}
                </pre>
              )}
            </div>
          )}

          {/* Archive Button */}
          {task.status !== "done" && (
            <button onClick={handleArchive} className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs hover:bg-[var(--card-hover)] transition">
              📦 Archive Task
            </button>
          )}

          {/* Comments Section */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-3">Comments ({comments.length})</h3>
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-sm text-[var(--text-dim)] text-center py-4">No comments yet</p>
              )}
              {comments.map(c => {
                const a = getAgentForComment(c.agent_id);
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="text-lg shrink-0 mt-0.5">{a.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{a.name}</span>
                        <span className="text-[10px] text-[var(--text-dim)]">{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-dim)] mt-0.5">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
          </div>
        </div>

        {/* Comment Input */}
        <div className="shrink-0 p-4 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAddComment()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-dim)]"
              placeholder="Add a comment..."
              disabled={sending}
            />
            <button onClick={handleAddComment} disabled={!commentInput.trim() || sending} className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
