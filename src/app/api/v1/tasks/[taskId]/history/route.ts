import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/tasks/:taskId/history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  const supabase = getServiceClient();

  // Verify task belongs to workspace
  const { data: task } = await supabase
    .from("task_queue")
    .select("id")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const { data: history, error } = await supabase
    .from("task_history")
    .select("id, task_id, event_type, actor, details, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return apiError("internal_error", "Failed to fetch task history", 500);
  }

  return apiSuccess({
    task_id: taskId,
    history: history || [],
    total: history?.length || 0,
  });
}
