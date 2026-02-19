import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { UpdateStatusRequest } from "@/lib/api/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { agentId } = await params;

  let body: UpdateStatusRequest;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (!body.status) {
    return apiError("validation_error", "status is required");
  }

  const validStatuses = ["online", "offline", "error", "paused"];
  if (!validStatuses.includes(body.status)) {
    return apiError("validation_error", `status must be one of: ${validStatuses.join(", ")}`);
  }

  const supabase = getServiceClient();

  // Verify agent belongs to workspace
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!agent) {
    return apiError("agent_not_found", "Agent not found in this workspace", 404);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agents")
    .update({
      status: body.status,
      status_message: body.status_message || null,
      updated_at: now,
    })
    .eq("id", agentId);

  if (error) {
    return apiError("internal_error", "Failed to update status", 500);
  }

  return apiSuccess({
    agent_id: agentId,
    status: body.status,
    updated_at: now,
  });
}
