import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks/:taskId/complete
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  const supabase = getServiceClient();

  // TODO Week 2: Full implementation with approval flow & notifications
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, needs_approval")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);

  const newStatus = task.needs_approval ? "pending-approval" : "completed";
  const now = new Date().toISOString();

  await supabase
    .from("task_queue")
    .update({
      status: newStatus,
      output: body.output || {},
      duration_ms: body.duration_ms || null,
      completed_at: now,
      progress_percent: 100,
      approval_status: task.needs_approval ? "pending" : null,
    })
    .eq("id", taskId);

  return apiSuccess({
    task_id: taskId,
    status: newStatus,
    approval_queue_position: task.needs_approval ? 1 : null,
    notification_sent: false, // TODO: implement notifications
  });
}
