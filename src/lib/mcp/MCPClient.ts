/**
 * MCPClient - Manages a single MCP server connection
 * Features: retry with exponential backoff, circuit breaker, tool caching, enriched errors
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPTool, MCPToolExecutionResult, CircuitBreakerState } from './types';

const TOOL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60 * 1000; // 1 minute
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private toolCache: MCPTool[] | null = null;
  private toolCacheTime = 0;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };

  constructor(
    public readonly config: MCPServerConfig,
    public readonly serverName: string = config.name,
  ) {}

  async connect(): Promise<void> {
    if (this.connected) return;

    if (this.config.transport !== 'stdio') {
      throw new Error(`Transport "${this.config.transport}" not yet supported`);
    }

    if (!this.config.command) {
      throw new Error(`No command specified for server "${this.serverName}"`);
    }

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args ?? [],
      env: { ...process.env, ...(this.config.env ?? {}) } as Record<string, string>,
    });

    this.client = new Client(
      { name: 'commandmate', version: '1.0.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      await this.client.close();
    } catch {
      // Ignore close errors
    }
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.toolCache = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listTools(forceRefresh = false): Promise<MCPTool[]> {
    if (
      !forceRefresh &&
      this.toolCache &&
      Date.now() - this.toolCacheTime < TOOL_CACHE_TTL_MS
    ) {
      return this.toolCache;
    }

    await this.ensureConnected();

    const result = await this.client!.listTools();
    this.toolCache = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
    this.toolCacheTime = Date.now();
    return this.toolCache;
  }

  async callTool(
    toolName: string,
    params: Record<string, unknown> = {},
  ): Promise<MCPToolExecutionResult> {
    this.checkCircuitBreaker();
    await this.ensureConnected();

    const start = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeWithTimeout(toolName, params);
        this.recordSuccess();
        const durationMs = Date.now() - start;

        const content = (result.content as Array<{ type: string; text?: string }>) ?? [];
        const isError = !!result.isError;
        return {
          success: !isError,
          content: content.map((c) => ({
            type: c.type ?? 'text',
            text: c.text,
          })),
          error: isError ? (content[0]?.text ?? 'Unknown error') : undefined,
          durationMs,
        };
      } catch (error) {
        lastError = error as Error;
        if (this.isTransientError(lastError) && attempt < MAX_RETRIES - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          // Try reconnecting for connection errors
          if (lastError.message.includes('ECONNREFUSED') || !this.connected) {
            this.connected = false;
            try { await this.connect(); } catch { /* will fail on next attempt */ }
          }
          continue;
        }
        break;
      }
    }

    this.recordFailure();
    const durationMs = Date.now() - start;
    const enriched = this.enrichError(lastError!, { toolName, params });

    return {
      success: false,
      error: enriched.message,
      durationMs,
    };
  }

  private async executeWithTimeout(
    toolName: string,
    params: Record<string, unknown>,
  ) {
    const timeout = this.config.timeout || DEFAULT_TIMEOUT_MS;

    return Promise.race([
      this.client!.callTool({ name: toolName, arguments: params }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout),
      ),
    ]);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private isTransientError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('epipe') ||
      msg.includes('socket hang up')
    );
  }

  private enrichError(
    error: Error,
    context: { toolName: string; params: Record<string, unknown> },
  ): Error {
    const enriched = new Error(
      `MCP Error [${this.serverName}/${context.toolName}]: ${error.message}`,
    );
    (enriched as any).originalError = error;
    (enriched as any).context = {
      server: this.serverName,
      tool: context.toolName,
      params: context.params,
    };
    return enriched;
  }

  private checkCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'open') {
      if (Date.now() - this.circuitBreaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
        this.circuitBreaker.state = 'half-open';
      } else {
        throw new Error(
          `Circuit breaker OPEN for server "${this.serverName}" - too many failures. Retry after ${Math.ceil((CIRCUIT_BREAKER_RESET_MS - (Date.now() - this.circuitBreaker.lastFailure)) / 1000)}s`,
        );
      }
    }
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker = { failures: 0, lastFailure: 0, state: 'closed' };
    }
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'open';
    }
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
