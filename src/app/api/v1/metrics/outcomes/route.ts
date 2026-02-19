import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/metrics/outcomes
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const { workspaceId } = auth;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "all";

  // Calculate date filter
  let dateFilter: string | null = null;
  const now = new Date();
  switch (period) {
    case "today":
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      break;
    case "week":
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "month":
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
  }

  // Build base query filter
  const baseQuery = () => {
    let q = supabase.from("task_queue").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId);
    if (dateFilter) q = q.gte("created_at", dateFilter);
    return q;
  };

  const [completed, pendingApproval, inProgress, failed] = await Promise.all([
    baseQuery().eq("status", "completed"),
    baseQuery().eq("status", "pending-approval"),
    baseQuery().eq("status", "in-progress"),
    baseQuery().eq("status", "failed"),
  ]);

  // Avg completion time
  let avgQuery = supabase
    .from("task_queue")
    .select("duration_ms")
    .eq("workspace_id", workspaceId)
    .not("duration_ms", "is", null);
  if (dateFilter) avgQuery = avgQuery.gte("created_at", dateFilter);
  const { data: durationData } = await avgQuery;

  let avgCompletionMinutes = 0;
  if (durationData && durationData.length > 0) {
    const totalMs = durationData.reduce((sum, d) => sum + (d.duration_ms || 0), 0);
    avgCompletionMinutes = Math.round(totalMs / durationData.length / 60000);
  }

  // Approval rate
  let approvalQuery = supabase
    .from("task_queue")
    .select("approval_status")
    .eq("workspace_id", workspaceId)
    .in("approval_status", ["approved", "rejected"]);
  if (dateFilter) approvalQuery = approvalQuery.gte("created_at", dateFilter);
  const { data: approvalData } = await approvalQuery;

  let approvalRate = 0;
  if (approvalData && approvalData.length > 0) {
    const approved = approvalData.filter((a) => a.approval_status === "approved").length;
    approvalRate = Math.round((approved / approvalData.length) * 100) / 100;
  }

  // Active agents (with tasks in last 24h)
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: activeAgentData } = await supabase
    .from("task_queue")
    .select("assigned_agent_id")
    .eq("workspace_id", workspaceId)
    .not("assigned_agent_id", "is", null)
    .gte("updated_at", last24h);

  const activeAgents = new Set((activeAgentData || []).map((a) => a.assigned_agent_id)).size;

  return apiSuccess({
    period,
    tasks_completed: completed.count || 0,
    tasks_pending_approval: pendingApproval.count || 0,
    tasks_in_progress: inProgress.count || 0,
    tasks_failed: failed.count || 0,
    agents_active: activeAgents,
    avg_completion_time_minutes: avgCompletionMinutes,
    approval_rate: approvalRate,
  });
}
