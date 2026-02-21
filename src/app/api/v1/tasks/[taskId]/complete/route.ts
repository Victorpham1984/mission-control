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

  if (!body.agent_id) {
    return apiError("validation_error", "agent_id is required");
  }

  const supabase = getServiceClient();

  const { data: task } = await supabase
    .from("task_queue")
    .select("id, needs_approval, assigned_agent_id, claimed_at, status")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);

  if (task.status !== 'in-progress') {
    return apiError("validation_error", "Task must be in-progress to complete", 400);
  }

  if (task.assigned_agent_id !== body.agent_id) {
    return apiError("validation_error", "Only the assigned agent can complete this task", 403);
  }

  const now = new Date().toISOString();
  const newStatus = task.needs_approval ? "pending-approval" : "completed";

  // Calculate duration
  let durationMs = body.duration_ms || null;
  if (!durationMs && task.claimed_at) {
    durationMs = new Date(now).getTime() - new Date(task.claimed_at).getTime();
  }

  await supabase
    .from("task_queue")
    .update({
      status: newStatus,
      output: body.output || {},
      duration_ms: durationMs,
      completed_at: now,
      progress_percent: 100,
      approval_status: task.needs_approval ? "pending" : null,
      updated_at: now,
    })
    .eq("id", taskId);

  // Get approval queue position
  let approvalQueuePosition = null;
  if (task.needs_approval) {
    const { count } = await supabase
      .from("task_queue")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId)
      .eq("status", "pending-approval");
    approvalQueuePosition = count ?? 1;
  }

  return apiSuccess({
    task_id: taskId,
    status: newStatus,
    approval_queue_position: approvalQueuePosition,
    notification_sent: false,
  });
}
