import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { dispatchWebhookEvent } from "@/lib/webhooks";

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

  // Validate agent belongs to workspace
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", body.agent_id)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!agent) {
    return apiError("validation_error", "Agent not found in this workspace", 400);
  }

  // Atomic claim: update only if status is still 'queued'
  const now = new Date().toISOString();
  const { data: claimed, error } = await supabase
    .from("task_queue")
    .update({
      status: "in-progress",
      assigned_agent_id: body.agent_id,
      claimed_at: now,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "queued")
    .select("id, status, assigned_agent_id")
    .maybeSingle();

  if (error) {
    return apiError("internal_error", "Failed to claim task", 500);
  }

  if (!claimed) {
    // Check if task exists at all
    const { data: existing } = await supabase
      .from("task_queue")
      .select("id, status, assigned_agent_id")
      .eq("id", taskId)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (!existing) {
      return apiError("task_not_found", "Task not found", 404);
    }
    return apiError("task_already_claimed", "Task is already claimed or not in queued state", 409);
  }

  // Dispatch webhook for task.assigned
  dispatchWebhookEvent(auth.workspaceId, "task.assigned", {
    task_id: taskId,
    title: "",
    description: null,
    priority: "",
    required_skills: [],
    status: "in-progress",
    assigned_agent_id: body.agent_id,
  });

  return apiSuccess({
    task_id: taskId,
    status: "in-progress",
    claimed_by: body.agent_id,
    claimed_at: now,
  });
}
