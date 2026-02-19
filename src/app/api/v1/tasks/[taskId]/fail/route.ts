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

  // TODO Week 2: Retry logic, reassignment, fail count tracking
  const newStatus = body.retry_suggested ? "queued" : "failed";

  await supabase
    .from("task_queue")
    .update({
      status: newStatus,
      error: body.error || "Unknown error",
      assigned_agent_id: body.retry_suggested ? null : undefined,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId);

  return apiSuccess({
    task_id: taskId,
    status: newStatus,
    action: body.retry_suggested ? "requeued" : "failed",
  });
}
