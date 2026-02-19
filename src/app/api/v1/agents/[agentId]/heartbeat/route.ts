import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { HeartbeatRequest } from "@/lib/api/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { agentId } = await params;

  let body: HeartbeatRequest;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const supabase = getServiceClient();

  // Verify agent belongs to workspace
  const { data: agent } = await supabase
    .from("agents")
    .select("id, workspace_id")
    .eq("id", agentId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!agent) {
    return apiError("agent_not_found", "Agent not found in this workspace", 404);
  }

  // Insert heartbeat
  await supabase.from("agent_heartbeats").insert({
    agent_id: agentId,
    status: body.status || "idle",
    load: body.load ?? 0,
    current_task_id: body.current_task_id || null,
    metadata: body.metadata || {},
  });

  // Update agent status
  await supabase
    .from("agents")
    .update({
      status: body.status === "error" ? "error" : "online",
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  // Count pending tasks for this workspace
  const { count } = await supabase
    .from("task_queue")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "queued");

  return apiSuccess({
    ack: true,
    pending_tasks: count ?? 0,
    server_time: new Date().toISOString(),
  });
}
