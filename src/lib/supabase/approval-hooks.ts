"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "./client";
import { getWorkspaceId, type TaskQueueItem } from "./hooks";

const supabase = createClient();

// Hook for fetching a single task detail
export function useTaskDetail(taskId: string) {
  const [task, setTask] = useState<TaskQueueItem | null>(null);
  const [agent, setAgent] = useState<{
    id: string; name: string; avatar_emoji: string | null; skills: string[] | null;
    role: string | null; about: string | null; type: string;
  } | null>(null);
  const [history, setHistory] = useState<{ event: string; time: string; detail?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }

    const { data: t } = await supabase
      .from("task_queue")
      .select("*")
      .eq("id", taskId)
      .eq("workspace_id", wsId)
      .single();

    if (!t) { setLoading(false); return; }

    const mapped: TaskQueueItem = {
      ...t,
      assigned_agent_name: undefined,
      assigned_agent_emoji: undefined,
    } as TaskQueueItem;

    // Get agent
    if (t.assigned_agent_id) {
      const { data: a } = await supabase
        .from("agents")
        .select("id, name, avatar_emoji, skills, role, about, type")
        .eq("id", t.assigned_agent_id)
        .single();
      if (a) {
        setAgent(a);
        mapped.assigned_agent_name = a.name;
        mapped.assigned_agent_emoji = a.avatar_emoji || undefined;
      }
    }

    setTask(mapped);

    // Build history timeline
    const timeline: { event: string; time: string; detail?: string }[] = [];
    if (t.created_at) timeline.push({ event: "Created", time: t.created_at });
    if (t.claimed_at) timeline.push({ event: "Assigned", time: t.claimed_at, detail: agent?.name });
    if (t.status === "in-progress" || t.status === "pending-approval" || t.status === "completed" || t.status === "failed") {
      timeline.push({ event: "In Progress", time: t.claimed_at || t.created_at });
    }
    if (t.completed_at && (t.status === "completed" || t.status === "pending-approval")) {
      timeline.push({ event: "Completed", time: t.completed_at });
    }
    if (t.status === "failed" && t.completed_at) {
      timeline.push({ event: "Failed", time: t.completed_at, detail: t.error || undefined });
    }
    if (t.status === "completed" && t.approval_status === "approved") {
      timeline.push({ event: "Approved", time: t.completed_at || t.created_at, detail: `Rating: ${t.approval_rating}/5` });
    }
    if (t.approval_status === "rejected") {
      timeline.push({ event: "Rejected", time: t.completed_at || t.created_at, detail: t.approval_feedback || undefined });
    }
    setHistory(timeline);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`task-detail-${taskId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_queue", filter: `id=eq.${taskId}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, loadData]);

  return { task, agent, history, loading, reload: loadData };
}

// Hook for agent performance metrics
export function useAgentMetrics(agentId: string) {
  const [metrics, setMetrics] = useState<{
    totalCompleted: number;
    successRate: number;
    avgRating: number;
    avgCompletionMs: number;
    skills: string[];
    recentTasks: TaskQueueItem[];
    tasksPerDay: { date: string; count: number }[];
    ratingDistribution: number[];
  } | null>(null);
  const [agent, setAgent] = useState<{
    id: string; name: string; avatar_emoji: string | null; skills: string[] | null;
    role: string | null; about: string | null; type: string; status: string; workspace_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) { setLoading(false); return; }

    // Get agent
    const { data: a } = await supabase
      .from("agents")
      .select("id, name, avatar_emoji, skills, role, about, type, status, workspace_id")
      .eq("id", agentId)
      .eq("workspace_id", wsId)
      .single();

    if (!a) { setLoading(false); return; }
    setAgent(a);

    // Get all tasks for this agent
    const { data: tasks } = await supabase
      .from("task_queue")
      .select("*")
      .eq("assigned_agent_id", agentId)
      .order("created_at", { ascending: false });

    const allTasks = (tasks || []) as TaskQueueItem[];
    const completed = allTasks.filter(t => t.status === "completed");
    const failed = allTasks.filter(t => t.status === "failed");
    const total = completed.length + failed.length;
    const successRate = total > 0 ? completed.length / total : 0;

    // Avg rating
    const rated = completed.filter(t => t.approval_rating);
    const avgRating = rated.length > 0
      ? rated.reduce((s, t) => s + (t.approval_rating || 0), 0) / rated.length
      : 0;

    // Avg completion time
    const withDuration = allTasks.filter(t => t.duration_ms);
    const avgCompletionMs = withDuration.length > 0
      ? withDuration.reduce((s, t) => s + (t.duration_ms || 0), 0) / withDuration.length
      : 0;

    // Tasks per day (last 7 days)
    const tasksPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = allTasks.filter(t => t.created_at?.startsWith(dateStr)).length;
      tasksPerDay.push({ date: dateStr, count });
    }

    // Rating distribution [0, count1, count2, count3, count4, count5]
    const ratingDist = [0, 0, 0, 0, 0, 0];
    rated.forEach(t => {
      const r = t.approval_rating || 0;
      if (r >= 1 && r <= 5) ratingDist[r]++;
    });

    setMetrics({
      totalCompleted: completed.length,
      successRate,
      avgRating: Math.round(avgRating * 10) / 10,
      avgCompletionMs,
      skills: a.skills || [],
      recentTasks: allTasks.slice(0, 10) as TaskQueueItem[],
      tasksPerDay,
      ratingDistribution: ratingDist,
    });
    setLoading(false);
  }, [agentId]);

  useEffect(() => { loadData(); }, [loadData]);

  return { agent, metrics, loading };
}
