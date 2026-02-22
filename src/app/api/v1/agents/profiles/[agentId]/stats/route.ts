import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

// GET /api/v1/agents/profiles/:agentId/stats — Performance stats
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { agentId } = await context.params;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "30d";
  const daysAgo = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date(Date.now() - daysAgo * 86400000).toISOString();

  const supabase = getServiceClient();

  // Resolve agent profile → agents table → task_queue
  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("id")
    .eq("workspace_id", auth.workspaceId)
    .eq("agent_id", agentId)
    .single();

  if (!profile) {
    return apiError("not_found", `Agent profile '${agentId}' not found`, 404);
  }

  // Find the agents table entry matching this agent_id
  const { data: agentRows } = await supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", auth.workspaceId)
    .ilike("external_id", `%${agentId}%`);

  const agentUuids = (agentRows || []).map((a) => a.id);

  if (agentUuids.length === 0) {
    return apiSuccess({
      agent_id: agentId,
      period,
      total_tasks: 0,
      avg_rating: 0,
      success_rate: 0,
      rating_distribution: {},
      quality_trend: [],
    });
  }

  // Fetch completed tasks with ratings
  const { data: tasks } = await supabase
    .from("task_queue")
    .select("id, approval_rating, completed_at, status")
    .in("assigned_agent_id", agentUuids)
    .gte("completed_at", since)
    .in("status", ["completed", "pending-approval"]);

  const allTasks = tasks || [];
  const ratedTasks = allTasks.filter((t) => t.approval_rating != null);
  const totalTasks = allTasks.length;
  const avgRating =
    ratedTasks.length > 0
      ? ratedTasks.reduce((sum, t) => sum + (t.approval_rating || 0), 0) / ratedTasks.length
      : 0;

  // Failed tasks for success rate
  const { count: failedCount } = await supabase
    .from("task_queue")
    .select("*", { count: "exact", head: true })
    .in("assigned_agent_id", agentUuids)
    .gte("created_at", since)
    .in("status", ["failed", "failed_permanent"]);

  const totalAttempted = totalTasks + (failedCount || 0);
  const successRate = totalAttempted > 0 ? totalTasks / totalAttempted : 0;

  // Rating distribution
  const ratingDistribution: Record<number, number> = {};
  ratedTasks.forEach((t) => {
    const r = t.approval_rating!;
    ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
  });

  // Weekly trend
  const buckets: Record<string, { sum: number; count: number }> = {};
  ratedTasks.forEach((t) => {
    const d = new Date(t.completed_at!);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().split("T")[0];
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += t.approval_rating!;
    buckets[key].count += 1;
  });

  const qualityTrend = Object.entries(buckets)
    .map(([date, b]) => ({ date, avg_rating: +(b.sum / b.count).toFixed(2) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return apiSuccess({
    agent_id: agentId,
    period,
    total_tasks: totalTasks,
    avg_rating: +avgRating.toFixed(2),
    success_rate: +successRate.toFixed(2),
    rating_distribution: ratingDistribution,
    quality_trend: qualityTrend,
  });
}
