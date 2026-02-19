import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/approvals — List pending approvals
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10");

  // TODO Week 2-3: Join with agent names, output preview
  const { data: tasks, error } = await supabase
    .from("task_queue")
    .select("id, title, assigned_agent_id, output, completed_at, created_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "pending-approval")
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error) return apiError("internal_error", "Failed to fetch approvals", 500);

  return apiSuccess({
    approvals: (tasks || []).map((t) => ({
      task_id: t.id,
      title: t.title,
      agent_id: t.assigned_agent_id,
      completed_at: t.completed_at,
    })),
    total_pending: tasks?.length || 0,
  });
}
