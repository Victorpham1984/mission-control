import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

// POST /api/v1/tasks/:taskId/evaluate — Quality scoring via Claude Opus 4
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { taskId } = await context.params;

  const supabase = getServiceClient();

  // Check if already evaluated
  const { data: existing } = await supabase
    .from("task_evaluations")
    .select("id, score")
    .eq("task_id", taskId)
    .single();

  if (existing) {
    return apiSuccess({ evaluation: existing, cached: true });
  }

  // Fetch task
  const { data: task, error: taskError } = await supabase
    .from("task_queue")
    .select("id, title, description, output, status, assigned_agent_id, workspace_id")
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (taskError || !task) {
    return apiError("not_found", "Task not found", 404);
  }

  if (!task.output) {
    return apiError("validation_error", "Task has no output to evaluate");
  }

  const outputStr =
    typeof task.output === "string" ? task.output : JSON.stringify(task.output);

  // Call Claude Opus 4 for quality scoring
  const evaluationPrompt = `You are a quality evaluator for AI-generated content. Score the following task output on a scale of 1-10.

TASK:
Title: ${task.title}
Description: ${task.description || "N/A"}

OUTPUT:
${outputStr.slice(0, 3000)}

Evaluate on these criteria:
1. Relevance (does it address the task?)
2. Quality (grammar, structure, coherence)
3. Completeness (thorough coverage)
4. Usefulness (actionable, valuable)

Respond in this exact JSON format:
{
  "score": <1-10>,
  "reasoning": "<2-3 sentence explanation>",
  "criteria": {
    "relevance": <1-10>,
    "quality": <1-10>,
    "completeness": <1-10>,
    "usefulness": <1-10>
  }
}`;

  const llmApiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY;
  const llmBaseUrl = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";

  if (!llmApiKey) {
    return apiError("config_error", "LLM API key not configured", 500);
  }

  try {
    const llmRes = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-opus-4",
        messages: [{ role: "user", content: evaluationPrompt }],
        max_tokens: 500,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text().catch(() => "");
      return apiError("llm_error", `LLM evaluation failed: ${llmRes.status} ${errText.slice(0, 200)}`, 502);
    }

    const llmData = await llmRes.json();
    const rawContent = llmData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return apiError("parse_error", "Failed to parse evaluation response", 500);
    }

    const evaluation = JSON.parse(jsonMatch[0]);
    const score = Math.max(1, Math.min(10, Math.round(evaluation.score)));

    // Store evaluation
    const { data: saved, error: saveError } = await supabase
      .from("task_evaluations")
      .insert({
        task_id: taskId,
        workspace_id: auth.workspaceId,
        evaluator: "claude-opus-4",
        score,
        reasoning: evaluation.reasoning || "",
        criteria: evaluation.criteria || {},
      })
      .select()
      .single();

    if (saveError) {
      return apiError("internal_error", "Failed to save evaluation: " + saveError.message, 500);
    }

    return apiSuccess({ evaluation: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return apiError("internal_error", "Evaluation failed: " + msg, 500);
  }
}
