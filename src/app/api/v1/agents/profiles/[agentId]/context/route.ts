import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

// GET /api/v1/agents/profiles/:agentId/context
// Returns agent persona + relevant workspace docs + memory for prompt injection
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { agentId } = await context.params;

  const supabase = getServiceClient();

  // Fetch agent profile
  const { data: agent, error: agentError } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .eq("agent_id", agentId)
    .single();

  if (agentError || !agent) {
    return apiError("not_found", `Agent profile '${agentId}' not found`, 404);
  }

  // Fetch workspace documents (brand guidelines + product catalogs first)
  const { data: docs } = await supabase
    .from("workspace_documents")
    .select("id, title, type, content")
    .eq("workspace_id", auth.workspaceId)
    .order("type", { ascending: true })
    .limit(10);

  // Fetch recent positive examples for this agent
  const { data: examples } = await supabase
    .from("agent_examples")
    .select("task_description, output_snippet, rating, feedback")
    .eq("agent_profile_id", agent.id)
    .eq("example_type", "positive")
    .order("created_at", { ascending: false })
    .limit(3);

  // Build context object for connector
  const styleGuide = agent.style_guide || {};
  const systemPrompt = buildSystemPrompt(agent, docs || [], examples || []);

  return apiSuccess({
    agent_id: agent.agent_id,
    name: agent.name,
    persona: agent.persona,
    style_guide: styleGuide,
    memory_context: agent.memory_context || [],
    expertise_areas: agent.expertise_areas || [],
    documents: (docs || []).map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      content_preview: d.content.slice(0, 500),
    })),
    examples: examples || [],
    system_prompt: systemPrompt,
  });
}

function buildSystemPrompt(
  agent: Record<string, unknown>,
  docs: Array<{ title: string; type: string; content: string }>,
  examples: Array<{ task_description: string; output_snippet: string; rating: number; feedback: string }>
): string {
  const styleGuide = (agent.style_guide || {}) as Record<string, unknown>;
  const memoryContext = (agent.memory_context || []) as string[];

  const brandDoc = docs.find((d) => d.type === "brand_guideline");
  const productDoc = docs.find((d) => d.type === "product_catalog");
  const styleDoc = docs.find((d) => d.type === "style_guide");

  let prompt = `${agent.persona}\n\n`;

  // Style instructions
  if (styleGuide.tone === "professional") {
    prompt += "Maintain a professional tone.\n";
  } else if (styleGuide.tone === "casual") {
    prompt += "Use a friendly, casual tone.\n";
  }
  if (styleGuide.emojiUsage) {
    prompt += "Use emojis appropriately.\n";
  } else if (styleGuide.emojiUsage === false) {
    prompt += "Avoid emojis.\n";
  }
  if (styleGuide.language) {
    prompt += `Primary language: ${styleGuide.language}\n`;
  }

  // Brand guidelines
  if (brandDoc) {
    prompt += `\nBRAND GUIDELINES:\n${brandDoc.content.slice(0, 1000)}\n`;
  }

  // Product catalog
  if (productDoc) {
    prompt += `\nPRODUCT CATALOG:\n${productDoc.content.slice(0, 1000)}\n`;
  }

  // Style guide doc
  if (styleDoc) {
    prompt += `\nSTYLE GUIDE:\n${styleDoc.content.slice(0, 500)}\n`;
  }

  // Memory / learnings
  if (memoryContext.length > 0) {
    prompt += `\nRECENT LEARNINGS:\n${memoryContext.slice(-5).join("\n")}\n`;
  }

  // Examples
  if (examples.length > 0) {
    prompt += `\nEXAMPLES OF GOOD WORK:\n`;
    for (const ex of examples.slice(0, 2)) {
      prompt += `- Task: ${ex.task_description}\n  Output: ${ex.output_snippet?.slice(0, 200)}\n`;
    }
  }

  return prompt;
}
