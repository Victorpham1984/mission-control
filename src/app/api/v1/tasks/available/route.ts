import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/tasks/available — Get available tasks matching agent skills
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const skills = url.searchParams.get("skills")?.split(",") || [];
  const limit = parseInt(url.searchParams.get("limit") || "5");

  const supabase = getServiceClient();

  // TODO Week 2: Skill matching logic with overlaps operator
  const { data: tasks, error } = await supabase
    .from("task_queue")
    .select("id, title, type, priority, required_skills, created_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "queued")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return apiError("internal_error", "Failed to fetch available tasks", 500);
  }

  return apiSuccess({
    tasks: (tasks || []).map((t) => ({
      task_id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      required_skills: t.required_skills,
      created_at: t.created_at,
    })),
    total_available: tasks?.length || 0,
  });
}
