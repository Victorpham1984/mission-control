import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/tasks/available — Get available tasks matching agent skills
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const skills = url.searchParams.get("skills")?.split(",").filter(Boolean) || [];
  const limit = parseInt(url.searchParams.get("limit") || "5");

  const supabase = getServiceClient();

  let query = supabase
    .from("task_queue")
    .select("id, title, type, priority, required_skills, created_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  // Skill matching: if skills provided, use overlaps operator
  if (skills.length > 0) {
    query = query.overlaps("required_skills", skills);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to fetch available tasks", 500);
  }

  // Sort by priority: urgent first, then normal, then background
  const priorityOrder: Record<string, number> = { urgent: 0, normal: 1, background: 2 };
  const sorted = (tasks || []).sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return apiSuccess({
    tasks: sorted.map((t) => ({
      task_id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      required_skills: t.required_skills,
      created_at: t.created_at,
      waiting_since: t.created_at,
    })),
    total_available: sorted.length,
  });
}
