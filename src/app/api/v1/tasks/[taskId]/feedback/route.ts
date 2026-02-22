import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

// POST /api/v1/tasks/:taskId/feedback — Submit rating + feedback
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { taskId } = await context.params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const { rating, feedback_text } = body;

  if (!rating || rating < 1 || rating > 5) {
    return apiError("validation_error", "rating must be between 1 and 5");
  }

  const supabase = getServiceClient();

  // Update task with rating
  const { data: task, error: taskError } = await supabase
    .from("task_queue")
    .update({
      approval_rating: rating,
      feedback_text: feedback_text || null,
      learned_at: rating >= 4 ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .select("id, title, description, output, approval_status, assigned_agent_id, workspace_id")
    .single();

  if (taskError || !task) {
    return apiError("not_found", "Task not found", 404);
  }

  // Resolve agent_id from agents table → agent_profiles
  if (task.assigned_agent_id) {
    const { data: agent } = await supabase
      .from("agents")
      .select("external_id")
      .eq("id", task.assigned_agent_id)
      .single();

    if (agent?.external_id) {
      // Extract short agent_id: "agent:minh" → "minh"
      const shortId = agent.external_id.split(":").pop() || agent.external_id;

      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("workspace_id", auth.workspaceId)
        .eq("agent_id", shortId)
        .single();

      if (profile) {
        // Save as example if 5⭐ or rejected
        const outputStr =
          typeof task.output === "string"
            ? task.output
            : JSON.stringify(task.output || "");

        if (rating === 5) {
          await supabase.from("agent_examples").insert({
            agent_profile_id: profile.id,
            task_id: taskId,
            example_type: "positive",
            task_description: task.description || task.title,
            output_snippet: outputStr.slice(0, 500),
            rating,
            feedback: feedback_text,
          });
        }

        if (task.approval_status === "rejected" || rating <= 2) {
          await supabase.from("agent_examples").insert({
            agent_profile_id: profile.id,
            task_id: taskId,
            example_type: "negative",
            task_description: task.description || task.title,
            output_snippet: outputStr.slice(0, 500),
            rating,
            feedback: feedback_text,
          });
        }
      }
    }
  }

  return apiSuccess({ success: true, task_id: taskId, rating });
}
