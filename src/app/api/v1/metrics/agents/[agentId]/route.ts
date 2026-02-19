import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/metrics/agents/:agentId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { agentId } = await params;
  const supabase = getServiceClient();

  // TODO Week 3: Proper performance metrics
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!agent) return apiError("agent_not_found", "Agent not found", 404);

  const { count } = await supabase
    .from("task_queue")
    .select("*", { count: "exact", head: true })
    .eq("assigned_agent_id", agentId)
    .eq("status", "completed");

  return apiSuccess({
    agent_id: agentId,
    name: agent.name,
    tasks_completed: count || 0,
    success_rate: 0, // TODO
    avg_quality_rating: 0, // TODO
    avg_completion_minutes: 0, // TODO
    top_skills: [], // TODO
  });
}
