/**
 * MCPServerRegistry - Manages multiple MCP server connections
 * Features: multi-server management, tool aggregation, metrics recording
 */

import { MCPClient } from './MCPClient';
import type {
  MCPServerConfig,
  MCPTool,
  MCPToolExecutionResult,
  MCPServerStatus,
} from './types';

export class MCPServerRegistry {
  private clients: Map<string, MCPClient> = new Map();

  /**
   * Add and connect to an MCP server
   */
  async addServer(config: MCPServerConfig): Promise<string> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server "${config.name}" (${config.id}) already registered`);
    }

    const client = new MCPClient(config, config.name);
    this.clients.set(config.id, client);
    return config.id;
  }

  /**
   * Remove a server and clean up its connection
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;

    await client.disconnect();
    this.clients.delete(serverId);
  }

  /**
   * Get a client by server ID
   */
  getClient(serverId: string): MCPClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * List tools from a specific server
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server "${serverId}" not found in registry`);
    }
    return client.listTools();
  }

  /**
   * List tools from ALL registered servers
   */
  async listAllTools(): Promise<Array<MCPTool & { serverId: string; serverName: string }>> {
    const allTools: Array<MCPTool & { serverId: string; serverName: string }> = [];

    for (const [serverId, client] of this.clients) {
      try {
        const tools = await client.listTools();
        for (const tool of tools) {
          allTools.push({
            ...tool,
            serverId,
            serverName: client.serverName,
          });
        }
      } catch {
        // Skip servers that fail to list tools
      }
    }

    return allTools;
  }

  /**
   * Execute a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown> = {},
  ): Promise<MCPToolExecutionResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server "${serverId}" not found in registry`);
    }
    return client.callTool(toolName, params);
  }

  /**
   * Get status of all registered servers
   */
  async getStatuses(): Promise<MCPServerStatus[]> {
    const statuses: MCPServerStatus[] = [];

    for (const [serverId, client] of this.clients) {
      let toolCount = 0;
      try {
        const tools = await client.listTools();
        toolCount = tools.length;
      } catch { /* ignore */ }

      const cb = client.getCircuitBreakerState();
      statuses.push({
        serverId,
        name: client.serverName,
        connected: client.isConnected(),
        healthy: cb.state !== 'open',
        toolCount,
        lastError: cb.state === 'open' ? 'Circuit breaker open - too many failures' : undefined,
      });
    }

    return statuses;
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map((c) => c.disconnect());
    await Promise.allSettled(promises);
    this.clients.clear();
  }

  /**
   * Number of registered servers
   */
  get size(): number {
    return this.clients.size;
  }
}
