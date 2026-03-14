/**
 * AgentToolExecutor - Bridges agent task execution with MCP tool calls
 * Features: task ownership validation, tool discovery per workspace, execution logging
 *
 * Flow:
 *   Agent claims task → discoverTools() → executeTool() → complete task
 *
 *   ┌─────────┐     ┌──────────────────┐     ┌───────────────┐
 *   │  Agent  │────▶│ AgentToolExecutor │────▶│ MCPServerReg  │
 *   └─────────┘     └──────────────────┘     └───────────────┘
 *        │                   │                       │
 *        │  validate task    │  resolve servers      │  connect + call
 *        │  ownership        │  for workspace        │  tool via stdio
 *        ▼                   ▼                       ▼
 *   ┌─────────┐     ┌──────────────────┐     ┌───────────────┐
 *   │task_queue│     │   mcp_servers    │     │   MCPClient   │
 *   └─────────┘     └──────────────────┘     └───────────────┘
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MCPServerRegistry } from './MCPServerRegistry';
import { MCPMetrics } from './metrics';
import type {
  AgentToolContext,
  AgentToolExecutionRequest,
  AgentToolExecutionResult,
  AvailableTool,
  MCPServerConfig,
} from './types';

export class AgentToolExecutor {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly registry: MCPServerRegistry,
  ) {}

  /**
   * Validate that agent owns the task and task is in-progress.
   * Returns task data or throws with a descriptive error.
   */
  async validateTaskOwnership(
    ctx: AgentToolContext,
  ): Promise<{ taskId: string; title: string; requiredSkills: string[] }> {
    const { data: task, error } = await this.supabase
      .from('task_queue')
      .select('id, title, status, assigned_agent_id, required_skills')
      .eq('id', ctx.taskId)
      .eq('workspace_id', ctx.workspaceId)
      .single();

    if (error || !task) {
      throw new AgentToolError('task_not_found', `Task ${ctx.taskId} not found`);
    }

    if (task.status !== 'in-progress') {
      throw new AgentToolError(
        'invalid_task_status',
        `Task must be in-progress to execute tools, got "${task.status}"`,
      );
    }

    if (task.assigned_agent_id !== ctx.agentId) {
      throw new AgentToolError(
        'not_assigned',
        `Agent ${ctx.agentId} is not assigned to task ${ctx.taskId}`,
      );
    }

    return {
      taskId: task.id,
      title: task.title,
      requiredSkills: (task.required_skills as string[]) ?? [],
    };
  }

  /**
   * Discover available MCP tools for a workspace.
   * Loads enabled servers from DB, ensures they are registered, aggregates tools.
   */
  async discoverTools(workspaceId: string): Promise<AvailableTool[]> {
    const { data: servers } = await this.supabase
      .from('mcp_servers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true);

    if (!servers || servers.length === 0) {
      return [];
    }

    const tools: AvailableTool[] = [];

    for (const server of servers) {
      try {
        await this.ensureServerRegistered(server as MCPServerConfig);
        const serverTools = await this.registry.listTools(server.id);
        for (const tool of serverTools) {
          tools.push({
            serverId: server.id,
            serverName: server.name,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      } catch {
        // Skip servers that fail to connect — don't block tool discovery
      }
    }

    return tools;
  }

  /**
   * Execute an MCP tool within the context of an agent's task.
   * Uses atomic conditional update to prevent race conditions:
   *   UPDATE task_queue SET status_message = ...
   *   WHERE id = ? AND status = 'in-progress' AND assigned_agent_id = ?
   * If 0 rows updated → task was reassigned or status changed concurrently.
   */
  async executeTool(
    ctx: AgentToolContext,
    request: AgentToolExecutionRequest,
  ): Promise<AgentToolExecutionResult> {
    // 1. Atomic ownership check + status_message update
    //    This replaces the separate validate + update pattern to close the race window.
    const { data: lockedTask } = await this.supabase
      .from('task_queue')
      .update({
        status_message: `Executing tool: ${request.toolName}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.taskId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'in-progress')
      .eq('assigned_agent_id', ctx.agentId)
      .select('id')
      .maybeSingle();

    if (!lockedTask) {
      // Determine the specific failure reason for a clear error message
      await this.validateTaskOwnership(ctx);
      // If validateTaskOwnership didn't throw, the task was modified between
      // the atomic update and the validation check — extremely rare but possible.
      throw new AgentToolError('invalid_task_status', 'Task state changed during execution');
    }

    // 2. Verify server exists and belongs to workspace
    const { data: server } = await this.supabase
      .from('mcp_servers')
      .select('id, name, workspace_id, enabled')
      .eq('id', request.serverId)
      .single();

    if (!server) {
      throw new AgentToolError('server_not_found', `MCP server ${request.serverId} not found`);
    }

    if (server.workspace_id !== ctx.workspaceId) {
      throw new AgentToolError(
        'server_not_in_workspace',
        `MCP server ${request.serverId} does not belong to this workspace`,
      );
    }

    if (!server.enabled) {
      throw new AgentToolError(
        'server_disabled',
        `MCP server "${server.name}" is disabled`,
      );
    }

    // 3. Ensure server is registered in the registry
    await this.ensureServerRegistered(server as MCPServerConfig);

    // 4. Execute tool
    const result = await this.registry.callTool(
      request.serverId,
      request.toolName,
      request.arguments,
    );

    // 5. Record metrics (fire and forget)
    MCPMetrics.recordToolExecution(
      request.serverId,
      request.toolName,
      result.durationMs,
      result.success,
      result.error,
    ).catch(() => {
      // Metrics recording failure is non-blocking
    });

    // 6. Update status message with result (conditional — only if still assigned)
    await this.supabase
      .from('task_queue')
      .update({
        status_message: result.success
          ? `Tool "${request.toolName}" completed`
          : `Tool "${request.toolName}" failed: ${result.error}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.taskId)
      .eq('status', 'in-progress')
      .eq('assigned_agent_id', ctx.agentId);

    return {
      success: result.success,
      content: result.content,
      error: result.error,
      durationMs: result.durationMs,
      toolName: request.toolName,
      serverId: request.serverId,
    };
  }

  /**
   * Ensure an MCP server is registered in the registry.
   * Lazy-connects: adds to registry if not already present.
   */
  private async ensureServerRegistered(config: MCPServerConfig): Promise<void> {
    if (!this.registry.getClient(config.id)) {
      await this.registry.addServer(config);
    }
  }
}

/**
 * Structured error for agent-tool integration failures.
 * Error codes map to HTTP statuses in the API route layer.
 */
export class AgentToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AgentToolError';
  }
}

/**
 * Map AgentToolError codes to HTTP status codes.
 */
export function agentToolErrorStatus(code: string): number {
  switch (code) {
    case 'task_not_found':
    case 'server_not_found':
      return 404;
    case 'not_assigned':
    case 'server_not_in_workspace':
      return 403;
    case 'invalid_task_status':
    case 'server_disabled':
      return 400;
    default:
      return 500;
  }
}
