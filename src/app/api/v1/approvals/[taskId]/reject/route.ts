import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/approvals/:taskId/reject
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

  // Verify task is pending approval
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, assigned_agent_id")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);
  if (task.status !== "pending-approval") {
    return apiError("validation_error", "Task is not pending approval");
  }

  const action = body.action || "revise";
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    approval_status: "rejected",
    approval_feedback: body.feedback || null,
    updated_at: now,
  };

  switch (action) {
    case "revise":
      // Same agent gets it back
      updateData.status = "queued";
      updateData.progress_percent = 0;
      updateData.completed_at = null;
      updateData.output = null;
      break;
    case "reassign":
      // Back to queue, unassign agent
      updateData.status = "queued";
      updateData.assigned_agent_id = null;
      updateData.claimed_at = null;
      updateData.progress_percent = 0;
      updateData.completed_at = null;
      updateData.output = null;
      break;
    case "cancel":
      updateData.status = "cancelled";
      break;
    default:
      return apiError("validation_error", "action must be 'revise', 'reassign', or 'cancel'");
  }

  await supabase
    .from("task_queue")
    .update(updateData)
    .eq("id", taskId);

  return apiSuccess({
    task_id: taskId,
    status: updateData.status as string,
    action,
  });
}
