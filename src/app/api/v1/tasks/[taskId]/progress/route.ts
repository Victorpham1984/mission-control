import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks/:taskId/progress
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  if (!body.agent_id) {
    return apiError("validation_error", "agent_id is required");
  }

  const progressPercent = body.progress_percent ?? 0;
  if (typeof progressPercent !== "number" || progressPercent < 0 || progressPercent > 100) {
    return apiError("validation_error", "progress_percent must be between 0 and 100");
  }

  const supabase = getServiceClient();

  // Verify task exists and agent is assigned
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, assigned_agent_id, status")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) {
    return apiError("task_not_found", "Task not found", 404);
  }

  if (task.assigned_agent_id !== body.agent_id) {
    return apiError("validation_error", "Only the assigned agent can report progress", 403);
  }

  await supabase
    .from("task_queue")
    .update({
      progress_percent: progressPercent,
      status_message: body.status_message || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  return apiSuccess({ ack: true });
}
