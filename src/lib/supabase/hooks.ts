"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "./client";
import type { Agent as DbAgent, Task as DbTask, Message as DbMessage } from "./types";
import type { Agent, Task, FeedItem } from "../data";

const supabase = createClient();

// Map DB agent to UI agent
function mapAgent(a: DbAgent): Agent {
  const cfg = a.config as Record<string, string>;
  const statusMap: Record<string, Agent["status"]> = {
    online: "working",
    offline: "idle",
    error: "error",
    paused: "idle",
  };
  return {
    id: a.id,
    name: a.name,
    role: a.role || cfg.role || a.description || "",
    badge: a.type === "founder" ? "founder" : (cfg.badge as Agent["badge"]) || "int",
    color: cfg.color || "#60a5fa",
    status: statusMap[a.status] || "idle",
    emoji: a.avatar_emoji || cfg.emoji || "🤖",
  };
}

// Map DB task to UI task
function mapTask(t: DbTask): Task {
  const input = t.input as Record<string, unknown>;
  const statusMap: Record<string, Task["status"]> = {
    pending: "inbox",
    running: "in-progress",
    completed: "done",
    failed: "review",
  };
  return {
    id: t.id as unknown as number, // we'll use string id but cast for compat
    title: (input.title as string) || "Untitled",
    desc: (input.description as string) || "",
    agent: t.agent_id,
    status: (input.kanban_status as Task["status"]) || statusMap[t.status] || "inbox",
    tags: (input.tags as string[]) || [],
    time: formatTime(t.created_at),
    result: t.output ? JSON.stringify(t.output, null, 2) : undefined,
  };
}

// Map DB message to feed item
function mapMessage(m: DbMessage, agents: DbAgent[]): FeedItem {
  const agent = agents.find(a => a.id === m.agent_id);
  const icon = m.is_broadcast ? "📢" : m.direction === "outbound" ? "🔄" : "💬";
  return {
    icon,
    text: `${agent?.name || "Agent"}: ${m.content}`,
    time: formatTime(m.created_at),
  };
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  return data?.id || null;
}

export function useWorkspaceData() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dbAgents, setDbAgents] = useState<DbAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const loadData = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }
    setWorkspaceId(wsId);

    const [agentsRes, tasksRes, messagesRes] = await Promise.all([
      supabase.from("agents").select("*").eq("workspace_id", wsId).order("created_at"),
      supabase.from("tasks").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50),
    ]);

    const rawAgents = agentsRes.data || [];
    const rawTasks = tasksRes.data || [];
    const rawMessages = messagesRes.data || [];

    setDbAgents(rawAgents);
    setAgents(rawAgents.map(mapAgent));
    setTasks(rawTasks.map(mapTask));
    setFeed(rawMessages.map(m => mapMessage(m, rawAgents)));
    setIsEmpty(rawAgents.length === 0 && rawTasks.length === 0);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel("workspace-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents", filter: `workspace_id=eq.${workspaceId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, loadData]);

  return { agents, dbAgents, tasks, setTasks, feed, setFeed, workspaceId, loading, isEmpty, reload: loadData };
}

export { supabase, getWorkspaceId };
