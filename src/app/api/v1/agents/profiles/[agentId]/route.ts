import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

// GET /api/v1/agents/profiles/:agentId
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { agentId } = await context.params;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .eq("agent_id", agentId)
    .single();

  if (error || !data) {
    return apiError("not_found", `Agent profile '${agentId}' not found`, 404);
  }

  return apiSuccess(data);
}

// PATCH /api/v1/agents/profiles/:agentId
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { agentId } = await context.params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (body.persona && body.persona.length > 2000) {
    return apiError("validation_error", "Persona must be 2000 chars or less");
  }

  const updateFields: Record<string, unknown> = {};
  if (body.name !== undefined) updateFields.name = body.name;
  if (body.persona !== undefined) updateFields.persona = body.persona;
  if (body.avatar_url !== undefined) updateFields.avatar_url = body.avatar_url;
  if (body.style_guide !== undefined) updateFields.style_guide = body.style_guide;
  if (body.expertise_areas !== undefined) updateFields.expertise_areas = body.expertise_areas;
  if (body.memory_context !== undefined) {
    // Max 10 learnings
    updateFields.memory_context = (body.memory_context as string[]).slice(0, 10);
  }

  if (Object.keys(updateFields).length === 0) {
    return apiError("validation_error", "No fields to update");
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("agent_profiles")
    .update(updateFields)
    .eq("workspace_id", auth.workspaceId)
    .eq("agent_id", agentId)
    .select()
    .single();

  if (error || !data) {
    return apiError("not_found", `Agent profile '${agentId}' not found`, 404);
  }

  return apiSuccess({ agent: data });
}

// DELETE /api/v1/agents/profiles/:agentId
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { agentId } = await context.params;

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("agent_profiles")
    .delete()
    .eq("workspace_id", auth.workspaceId)
    .eq("agent_id", agentId);

  if (error) {
    return apiError("internal_error", "Failed to delete: " + error.message, 500);
  }

  return apiSuccess({ deleted: true });
}
