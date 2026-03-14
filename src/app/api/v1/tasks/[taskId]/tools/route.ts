import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { AgentToolExecutor, AgentToolError, agentToolErrorStatus } from "@/lib/mcp";
import { getSharedRegistry } from "@/lib/mcp/registry-singleton";

// GET /api/v1/tasks/:taskId/tools — Discover MCP tools available for this task
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent_id");

  if (!agentId) {
    return apiError("validation_error", "agent_id query parameter is required");
  }

  const supabase = getServiceClient();
  const executor = new AgentToolExecutor(supabase, getSharedRegistry());

  try {
    // Validate agent owns the task
    await executor.validateTaskOwnership({
      taskId,
      agentId,
      workspaceId: auth.workspaceId,
    });

    // Discover tools for workspace
    const tools = await executor.discoverTools(auth.workspaceId);

    return apiSuccess({
      task_id: taskId,
      tools,
      total: tools.length,
    });
  } catch (err) {
    if (err instanceof AgentToolError) {
      return apiError(err.code, err.message, agentToolErrorStatus(err.code));
    }
    return apiError("internal_error", "Failed to discover tools", 500);
  }
}
