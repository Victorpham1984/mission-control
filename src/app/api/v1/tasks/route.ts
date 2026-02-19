import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks — Create task
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (!body.title) {
    return apiError("validation_error", "title is required");
  }

  const supabase = getServiceClient();

  // TODO Week 2: Full implementation with skill matching & auto-assignment
  const { data: task, error } = await supabase
    .from("task_queue")
    .insert({
      workspace_id: auth.workspaceId,
      title: body.title,
      description: body.description || null,
      type: body.type || "custom",
      priority: body.priority || "normal",
      required_skills: body.required_skills || [],
      needs_approval: body.needs_approval ?? true,
      parent_task_id: body.parent_task_id || null,
      batch_id: body.metadata?.batch_id || null,
      batch_index: body.metadata?.batch_index || null,
      metadata: body.metadata || {},
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    return apiError("internal_error", "Failed to create task: " + error.message, 500);
  }

  return apiSuccess(
    {
      task_id: task.id,
      status: task.status,
      position_in_queue: 0, // TODO: calculate actual position
      estimated_assignment: "< 1 min",
      created_at: task.created_at,
    },
    201
  );
}

// GET /api/v1/tasks — List tasks
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  let query = supabase
    .from("task_queue")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to list tasks", 500);
  }

  return apiSuccess({ tasks: tasks || [], total: tasks?.length || 0 });
}
