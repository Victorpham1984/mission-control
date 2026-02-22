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
    setFeed(rawMessages.map((m: any) => mapMessage(m, rawAgents)));
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

// === Task Queue types & hook ===

export type TaskQueueItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string; // queued, in-progress, pending-approval, completed, failed
  priority: string; // urgent, normal, background
  assigned_agent_id: string | null;
  assigned_agent_name?: string;
  assigned_agent_emoji?: string;
  progress_percent: number | null;
  needs_approval: boolean | null;
  approval_status: string | null;
  approval_rating: number | null;
  approval_feedback: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
  required_skills: string[] | null;
  status_message: string | null;
  duration_ms: number | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type TaskQueueMetrics = {
  completed: number;
  pendingApproval: number;
  inProgress: number;
  failed: number;
  queued: number;
};

export function useTaskQueue() {
  const [tasks, setTasks] = useState<TaskQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }
    setWorkspaceId(wsId);

    // Fetch task_queue with agent info
    const { data: rawTasks } = await supabase
      .from("task_queue")
      .select("*, agents!task_queue_assigned_agent_id_fkey(name, avatar_emoji)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });

    const { data: agentsData } = await supabase
      .from("agents")
      .select("id, name, avatar_emoji")
      .eq("workspace_id", wsId);

    const agentMap = new Map((agentsData || []).map((a: any) => [a.id, a]));

    const mapped: TaskQueueItem[] = (rawTasks || []).map((t: Record<string, unknown>) => {
      const agent: any = t.assigned_agent_id ? agentMap.get(t.assigned_agent_id as string) : null;
      return {
        ...t,
        assigned_agent_name: agent?.name || undefined,
        assigned_agent_emoji: agent?.avatar_emoji || undefined,
      } as TaskQueueItem;
    });

    setTasks(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel("task-queue-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_queue", filter: `workspace_id=eq.${workspaceId}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, loadData]);

  const pendingApprovals = tasks.filter(t => t.status === "pending-approval");
  const activeTasks = tasks.filter(t => t.status === "in-progress");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const queuedTasks = tasks.filter(t => t.status === "queued");
  const failedTasks = tasks.filter(t => t.status === "failed");

  const metrics: TaskQueueMetrics = {
    completed: completedTasks.length,
    pendingApproval: pendingApprovals.length,
    inProgress: activeTasks.length,
    failed: failedTasks.length,
    queued: queuedTasks.length,
  };

  const approveTask = async (taskId: string, rating: number, comment?: string) => {
    const response = await fetch(`/api/v1/approvals/${taskId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rating, comment }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to approve task");
    }
    
    return response.json();
  };

  const rejectTask = async (taskId: string, feedback: string, action: "revise" | "reassign" | "cancel") => {
    const response = await fetch(`/api/v1/approvals/${taskId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ feedback, action }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to reject task");
    }
    
    return response.json();
  };

  return {
    tasks, pendingApprovals, activeTasks, completedTasks, queuedTasks, failedTasks,
    metrics, loading, approveTask, rejectTask, reload: loadData,
  };
}

// === Agent Heartbeats hook ===

export type AgentHeartbeat = {
  agent_id: string;
  status: "online" | "away" | "offline";
  status_message: string | null;
  last_heartbeat: string | null;
  current_task_id: string | null;
  load: number | null;
};

export function useAgentHeartbeats() {
  const [heartbeats, setHeartbeats] = useState<Map<string, AgentHeartbeat>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadHeartbeats = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }

    // Get latest heartbeat per agent using distinct on
    const { data: agents } = await supabase
      .from("agents")
      .select("id")
      .eq("workspace_id", wsId);

    if (!agents) { setLoading(false); return; }

    const agentIds = agents.map((a: any) => a.id);
    const { data: hbs } = await supabase
      .from("agent_heartbeats")
      .select("*")
      .in("agent_id", agentIds)
      .order("created_at", { ascending: false });

    const map = new Map<string, AgentHeartbeat>();
    const now = Date.now();

    // Group by agent, take latest
    for (const hb of (hbs || [])) {
      if (map.has(hb.agent_id)) continue;
      const elapsed = now - new Date(hb.created_at || 0).getTime();
      const fiveMin = 5 * 60 * 1000;
      const thirtyMin = 30 * 60 * 1000;
      let status: "online" | "away" | "offline" = "offline";
      if (elapsed < fiveMin) status = "online";
      else if (elapsed < thirtyMin) status = "away";

      const meta = hb.metadata as Record<string, unknown> | null;
      map.set(hb.agent_id, {
        agent_id: hb.agent_id,
        status,
        status_message: (meta?.status_message as string) || null,
        last_heartbeat: hb.created_at,
        current_task_id: hb.current_task_id,
        load: hb.load,
      });
    }

    // Agents with no heartbeat = offline
    for (const id of agentIds) {
      if (!map.has(id)) {
        map.set(id, { agent_id: id, status: "offline", status_message: null, last_heartbeat: null, current_task_id: null, load: null });
      }
    }

    setHeartbeats(map);
    setLoading(false);
  }, []);

  useEffect(() => { loadHeartbeats(); }, [loadHeartbeats]);

  // Refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadHeartbeats, 30000);
    return () => clearInterval(interval);
  }, [loadHeartbeats]);

  return { heartbeats, loading };
}

export { supabase, getWorkspaceId };
