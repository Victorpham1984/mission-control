import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks/:taskId/claim
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

  // TODO Week 2: Atomic claim with proper locking
  const { data: task } = await supabase
    .from("task_queue")
    .select("id, status, assigned_agent_id")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!task) return apiError("task_not_found", "Task not found", 404);
  if (task.status !== "queued") {
    return apiError("task_already_claimed", "Task is already claimed", 409);
  }

  const now = new Date().toISOString();
  await supabase
    .from("task_queue")
    .update({ status: "in-progress", assigned_agent_id: body.agent_id, claimed_at: now })
    .eq("id", taskId);

  return apiSuccess({ task_id: taskId, status: "in-progress", claimed_by: body.agent_id, claimed_at: now });
}
