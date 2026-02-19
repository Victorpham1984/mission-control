import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/approvals — List pending approvals
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10");

  // Get tasks with agent details
  const { data: tasks, error } = await supabase
    .from("task_queue")
    .select("id, title, assigned_agent_id, output, completed_at, created_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "pending-approval")
    .order("completed_at", { ascending: true })
    .limit(limit);

  if (error) return apiError("internal_error", "Failed to fetch approvals", 500);

  // Get agent details for all assigned agents
  const agentIds = [...new Set((tasks || []).map((t) => t.assigned_agent_id).filter(Boolean))];
  let agentMap: Record<string, { name: string; emoji: string }> = {};

  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, emoji")
      .in("id", agentIds);

    if (agents) {
      agentMap = Object.fromEntries(
        agents.map((a) => [a.id, { name: a.name, emoji: a.emoji || "" }])
      );
    }
  }

  const now = new Date();
  const approvals = (tasks || []).map((t) => {
    const agent = agentMap[t.assigned_agent_id] || { name: "Unknown", emoji: "" };
    const output = t.output as Record<string, unknown> | null;
    const outputContent = output?.content as string || "";
    const outputPreview = outputContent.substring(0, 200);
    const completedAt = t.completed_at ? new Date(t.completed_at) : now;
    const waitingMs = now.getTime() - completedAt.getTime();
    const waitingMinutes = Math.floor(waitingMs / 60000);
    const waitingSince = waitingMinutes < 60
      ? `${waitingMinutes}m`
      : `${Math.floor(waitingMinutes / 60)}h ${waitingMinutes % 60}m`;

    return {
      task_id: t.id,
      title: t.title,
      agent_name: `${agent.emoji} ${agent.name}`.trim(),
      agent_id: t.assigned_agent_id,
      output_preview: outputPreview,
      completed_at: t.completed_at,
      waiting_since: waitingSince,
    };
  });

  return apiSuccess({
    approvals,
    total_pending: approvals.length,
  });
}
