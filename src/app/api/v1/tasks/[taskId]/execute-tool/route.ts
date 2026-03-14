import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { AgentToolExecutor, AgentToolError, agentToolErrorStatus } from "@/lib/mcp";
import { getSharedRegistry } from "@/lib/mcp/registry-singleton";

// POST /api/v1/tasks/:taskId/execute-tool — Execute MCP tool within task context
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const { agent_id, server_id, tool_name, arguments: toolArgs } = body;

  if (!agent_id) {
    return apiError("validation_error", "agent_id is required");
  }
  if (!server_id) {
    return apiError("validation_error", "server_id is required");
  }
  if (!tool_name) {
    return apiError("validation_error", "tool_name is required");
  }

  const supabase = getServiceClient();
  const executor = new AgentToolExecutor(supabase, getSharedRegistry());

  try {
    const result = await executor.executeTool(
      {
        taskId,
        agentId: agent_id,
        workspaceId: auth.workspaceId,
      },
      {
        serverId: server_id,
        toolName: tool_name,
        arguments: toolArgs ?? {},
      },
    );

    return apiSuccess({
      task_id: taskId,
      tool_name: result.toolName,
      server_id: result.serverId,
      success: result.success,
      content: result.content,
      error: result.error,
      duration_ms: result.durationMs,
    });
  } catch (err) {
    if (err instanceof AgentToolError) {
      return apiError(err.code, err.message, agentToolErrorStatus(err.code));
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return apiError("tool_execution_error", message, 500);
  }
}
