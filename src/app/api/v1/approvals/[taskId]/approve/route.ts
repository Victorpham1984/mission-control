import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/approvals/:taskId/approve
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  const supabase = getServiceClient();

  // Verify task is pending approval
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, approval_status")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);
  if (task.status !== "pending-approval") {
    return apiError("validation_error", "Task is not pending approval");
  }

  // Validate rating
  if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
    return apiError("validation_error", "Rating must be between 1 and 5");
  }

  const now = new Date().toISOString();
  await supabase
    .from("task_queue")
    .update({
      status: "completed",
      approval_status: "approved",
      approval_rating: body.rating || null,
      approval_feedback: body.comment || null,
      approved_by: auth.userId || null,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", taskId);

  return apiSuccess({
    task_id: taskId,
    status: "completed",
    approval_status: "approved",
    approved_at: now,
  });
}
