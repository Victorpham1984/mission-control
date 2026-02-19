import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/metrics/outcomes
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  // TODO Week 3: Proper aggregation queries
  const supabase = getServiceClient();
  const { workspaceId } = auth;

  const counts = await Promise.all([
    supabase.from("task_queue").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
    supabase.from("task_queue").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending-approval"),
    supabase.from("task_queue").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "in-progress"),
    supabase.from("task_queue").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "failed"),
    supabase.from("agents").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "online"),
  ]);

  return apiSuccess({
    period: "all",
    tasks_completed: counts[0].count || 0,
    tasks_pending_approval: counts[1].count || 0,
    tasks_in_progress: counts[2].count || 0,
    tasks_failed: counts[3].count || 0,
    agents_active: counts[4].count || 0,
    avg_completion_time_minutes: 0, // TODO
    approval_rate: 0, // TODO
  });
}
