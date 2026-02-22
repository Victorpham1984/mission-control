import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { RegisterAgentRequest } from "@/lib/api/types";

export async function POST(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  let body: RegisterAgentRequest;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (!body.name || !body.external_id || !body.type) {
    return apiError("validation_error", "name, external_id, and type are required");
  }

  const supabase = getServiceClient();
  const { workspaceId } = auth;

  // Check if agent with this external_id already exists in workspace
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", body.external_id)
    .maybeSingle();

  // Generate agent token
  const agentToken = "cma_" + crypto.randomUUID().replace(/-/g, "");
  const tokenHashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(agentToken)
  );
  const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let agentId: string;

  if (existing) {
    // Update existing agent
    const { error } = await supabase
      .from("agents")
      .update({
        name: body.name,
        type: body.type,
        role: body.role || null,
        capacity: body.capacity ?? 3,
        agent_token_hash: tokenHash,
        status: "online",
        config: body.metadata ? { ...body.metadata } : {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return apiError("internal_error", "Failed to update agent: " + error.message, 500);
    }
    agentId = existing.id;
  } else {
    // Create new agent
    const { data: newAgent, error } = await supabase
      .from("agents")
      .insert({
        workspace_id: workspaceId,
        name: body.name,
        external_id: body.external_id,
        type: body.type,
        role: body.role || null,
        capacity: body.capacity ?? 3,
        agent_token_hash: tokenHash,
        status: "online",
        config: body.metadata ? { ...body.metadata } : {},
      })
      .select("id")
      .single();

    if (error) {
      return apiError("internal_error", "Failed to create agent: " + error.message, 500);
    }
    agentId = newAgent.id;
  }

  // Upsert skills
  if (body.skills && body.skills.length > 0) {
    // Delete old skills
    await supabase.from("agent_skills").delete().eq("agent_id", agentId);

    // Insert new skills
    const skillRows = body.skills.map((skill) => ({
      agent_id: agentId,
      skill,
      proficiency: 1.0,
    }));
    await supabase.from("agent_skills").insert(skillRows);
  }

  return apiSuccess(
    {
      agent_id: agentId,
      api_token: agentToken,
      workspace_id: workspaceId,
      status: "registered",
    },
    existing ? 200 : 201
  );
}
