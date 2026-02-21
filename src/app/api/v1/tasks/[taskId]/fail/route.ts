import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { logTaskEvent } from "@/lib/api/task-history";
import { NotificationService } from "@/lib/notifications";

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
    .select("id, status, metadata, assigned_agent_id, retry_count")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);

  if (!['in-progress', 'queued'].includes(task.status)) {
    return apiError("validation_error", "Task must be in-progress or queued to fail", 400);
  }

  const currentRetryCount = (task.retry_count as number) || 0;
  const newRetryCount = currentRetryCount + 1;
  const errorMsg = body.error || "Unknown error";

  // Log the failure event
  await logTaskEvent(supabase, taskId, "failed", task.assigned_agent_id || "system", {
    error: errorMsg,
    retry_count: newRetryCount,
    agent_id: task.assigned_agent_id,
  });

  let newStatus: string;
  let action: string;

  if (newRetryCount >= 3) {
    // Permanent failure after 3 attempts
    newStatus = "failed_permanent";
    action = "permanently_failed";

    await logTaskEvent(supabase, taskId, "permanently_failed", "system", {
      total_retries: newRetryCount,
      final_error: errorMsg,
    });
  } else {
    // Auto-retry: requeue
    newStatus = "queued";
    action = "retried";

    await logTaskEvent(supabase, taskId, "retried", "system", {
      retry_attempt: newRetryCount,
      previous_agent_id: task.assigned_agent_id,
    });
  }

  // Track fail count in metadata for backward compat
  const metadata = (task.metadata as Record<string, unknown>) || {};
  metadata.fail_count = newRetryCount;

  const updateData: Record<string, unknown> = {
    status: newStatus,
    error: errorMsg,
    metadata,
    retry_count: newRetryCount,
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

  // Notify on permanent failure
  if (newStatus === "failed_permanent") {
    try {
      const notificationService = new NotificationService(supabase);
      await notificationService.notifyTaskEvent(taskId, "failed_permanent", auth.workspaceId);
    } catch {
      // Non-blocking
    }
  }

  return apiSuccess({
    task_id: taskId,
    status: newStatus,
    action,
    retry_count: newRetryCount,
    max_retries: 3,
    fail_count: newRetryCount,
  });
}
