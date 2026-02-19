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

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!agent) return apiError("agent_not_found", "Agent not found", 404);

  // Get completed and failed counts
  const [completedRes, failedRes] = await Promise.all([
    supabase
      .from("task_queue")
      .select("*", { count: "exact", head: true })
      .eq("assigned_agent_id", agentId)
      .eq("status", "completed"),
    supabase
      .from("task_queue")
      .select("*", { count: "exact", head: true })
      .eq("assigned_agent_id", agentId)
      .eq("status", "failed"),
  ]);

  const completedCount = completedRes.count || 0;
  const failedCount = failedRes.count || 0;
  const total = completedCount + failedCount;
  const successRate = total > 0 ? Math.round((completedCount / total) * 100) / 100 : 0;

  // Avg quality rating
  const { data: ratingData } = await supabase
    .from("task_queue")
    .select("approval_rating")
    .eq("assigned_agent_id", agentId)
    .not("approval_rating", "is", null);

  let avgRating = 0;
  if (ratingData && ratingData.length > 0) {
    const totalRating = ratingData.reduce((sum, r) => sum + (r.approval_rating || 0), 0);
    avgRating = Math.round((totalRating / ratingData.length) * 10) / 10;
  }

  // Avg completion time
  const { data: durationData } = await supabase
    .from("task_queue")
    .select("duration_ms")
    .eq("assigned_agent_id", agentId)
    .not("duration_ms", "is", null);

  let avgMinutes = 0;
  if (durationData && durationData.length > 0) {
    const totalMs = durationData.reduce((sum, d) => sum + (d.duration_ms || 0), 0);
    avgMinutes = Math.round(totalMs / durationData.length / 60000);
  }

  // Top skills
  const { data: skills } = await supabase
    .from("agent_skills")
    .select("skill, proficiency")
    .eq("agent_id", agentId)
    .order("proficiency", { ascending: false });

  return apiSuccess({
    agent_id: agentId,
    name: agent.name,
    tasks_completed: completedCount,
    success_rate: successRate,
    avg_quality_rating: avgRating,
    avg_completion_minutes: avgMinutes,
    top_skills: (skills || []).map((s) => s.skill),
  });
}
