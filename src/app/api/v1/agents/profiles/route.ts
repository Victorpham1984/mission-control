import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/agents/profiles — List all agent profiles in workspace
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("agent_profiles")
    .select("id, agent_id, name, avatar_url, expertise_areas, performance_stats, style_guide")
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return apiError("internal_error", "Failed to list agents: " + error.message, 500);
  }

  return apiSuccess({ agents: data || [] });
}

// POST /api/v1/agents/profiles — Create agent profile
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (!body.agent_id || !body.name || !body.persona) {
    return apiError("validation_error", "agent_id, name, and persona are required");
  }

  if (body.persona && body.persona.length > 2000) {
    return apiError("validation_error", "Persona must be 2000 chars or less");
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("agent_profiles")
    .insert({
      workspace_id: auth.workspaceId,
      agent_id: body.agent_id,
      name: body.name,
      avatar_url: body.avatar_url || null,
      persona: body.persona,
      style_guide: body.style_guide || {},
      expertise_areas: body.expertise_areas || [],
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("conflict", "Agent profile already exists for this agent_id", 409);
    }
    return apiError("internal_error", "Failed to create agent: " + error.message, 500);
  }

  return apiSuccess({ agent: data }, 201);
}
