import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks/:taskId/fail
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

  // Get current task
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, metadata, assigned_agent_id")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);

  // Track fail count in metadata
  const metadata = (task.metadata as Record<string, unknown>) || {};
  const failCount = ((metadata.fail_count as number) || 0) + 1;
  metadata.fail_count = failCount;

  const retrySuggested = body.retry_suggested ?? false;
  let newStatus: string;
  let action: string;

  if (failCount >= 3) {
    // Permanent failure after 3 attempts
    newStatus = "failed";
    action = "permanently_failed";
  } else if (retrySuggested) {
    // Requeue for another attempt
    newStatus = "queued";
    action = "requeued";
  } else {
    newStatus = "failed";
    action = "failed";
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    error: body.error || "Unknown error",
    metadata,
    updated_at: new Date().toISOString(),
  };

  // If requeuing, unassign the agent
  if (newStatus === "queued") {
    updateData.assigned_agent_id = null;
    updateData.claimed_at = null;
    updateData.progress_percent = 0;
    updateData.status_message = null;
  }

  await supabase
    .from("task_queue")
    .update(updateData)
    .eq("id", taskId);

  return apiSuccess({
    task_id: taskId,
    status: newStatus,
    action,
    fail_count: failCount,
  });
}
