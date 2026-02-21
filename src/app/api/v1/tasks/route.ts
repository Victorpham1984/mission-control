import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { dispatchWebhookEvent } from "@/lib/webhooks";

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

  // Create the task
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

  // Calculate position in queue
  const { count } = await supabase
    .from("task_queue")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "queued")
    .lt("created_at", task.created_at);

  const position = (count ?? 0) + 1;

  // Auto-assignment: find idle agent with matching skills
  let autoAssigned = false;
  const reqSkills = body.required_skills || [];
  if (reqSkills.length > 0) {
    // Find agents with matching skills that are online and idle
    const { data: matchingSkills } = await supabase
      .from("agent_skills")
      .select("agent_id, skill")
      .in("skill", reqSkills);

    if (matchingSkills && matchingSkills.length > 0) {
      const candidateIds = [...new Set(matchingSkills.map((s) => s.agent_id))];

      // Find an online agent not currently busy
      const { data: idleAgents } = await supabase
        .from("agents")
        .select("id")
        .eq("workspace_id", auth.workspaceId)
        .eq("status", "online")
        .in("id", candidateIds)
        .limit(1);

      if (idleAgents && idleAgents.length > 0) {
        // Check agent doesn't have too many in-progress tasks
        const agentId = idleAgents[0].id;
        const { count: activeCount } = await supabase
          .from("task_queue")
          .select("*", { count: "exact", head: true })
          .eq("assigned_agent_id", agentId)
          .eq("status", "in-progress");

        if ((activeCount ?? 0) === 0) {
          const now = new Date().toISOString();
          await supabase
            .from("task_queue")
            .update({ status: "in-progress", assigned_agent_id: agentId, claimed_at: now })
            .eq("id", task.id);
          autoAssigned = true;
        }
      }
    }
  }

  // Dispatch webhook for task.created
  dispatchWebhookEvent(auth.workspaceId, "task.created", {
    task_id: task.id,
    title: body.title,
    description: body.description || null,
    priority: body.priority || "normal",
    required_skills: body.required_skills || [],
    status: autoAssigned ? "in-progress" : task.status,
    assigned_agent_id: null,
  });

  return apiSuccess(
    {
      task_id: task.id,
      status: autoAssigned ? "in-progress" : task.status,
      position_in_queue: autoAssigned ? 0 : position,
      estimated_assignment: autoAssigned ? "auto-assigned" : "< 1 min",
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
