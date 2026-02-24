/**
 * MCP Types for CommandMate
 */

export interface MCPServerConfig {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  timeout: number;
  created_at: string;
  updated_at: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolExecutionRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolExecutionResult {
  success: boolean;
  content?: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  error?: string;
  durationMs: number;
}

export interface MCPServerStatus {
  serverId: string;
  name: string;
  connected: boolean;
  healthy: boolean;
  toolCount: number;
  lastError?: string;
  averageLatencyMs?: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}
