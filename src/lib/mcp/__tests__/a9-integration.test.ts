/**
 * A9 Integration Tests — End-to-end agent↔MCP task flow
 *
 * Proves stability across both stdio and SSE transports.
 * Each test is independent, deterministic, and CI-safe.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { MCPClient } from '../MCPClient';
import { MCPServerRegistry } from '../MCPServerRegistry';
import { AgentToolExecutor, AgentToolError } from '../agent-integration';
import type { MCPServerConfig } from '../types';

// ── Test SSE Server ───────────────────────────────────────────────────

function createTestMCPServer(): McpServer {
  const server = new McpServer(
    { name: 'a9-test-server', version: '1.0.0' },
  );

  server.tool('echo', 'Echo input', { message: z.string() }, async ({ message }) => ({
    content: [{ type: 'text' as const, text: `echo: ${message}` }],
  }));

  server.tool('add', 'Add numbers', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: 'text' as const, text: String(a + b) }],
  }));

  server.tool('slow', 'Sleeps then responds', { ms: z.number() }, async ({ ms }) => {
    await new Promise((r) => setTimeout(r, ms));
    return { content: [{ type: 'text' as const, text: 'done' }] };
  });

  server.tool('fail', 'Always fails', {}, async () => ({
    content: [{ type: 'text' as const, text: 'intentional failure' }],
    isError: true,
  }));

  return server;
}

async function startSSEServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const transports = new Map<string, SSEServerTransport>();
  const httpServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
    if (reqUrl.pathname === '/sse' && req.method === 'GET') {
      const mcpServer = createTestMCPServer();
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      await mcpServer.connect(transport);
      return;
    }
    if (reqUrl.pathname === '/messages' && req.method === 'POST') {
      const sessionId = reqUrl.searchParams.get('sessionId');
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) { res.writeHead(400); res.end('Unknown session'); return; }
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', async () => {
        await transport.handlePostMessage(req, res, JSON.parse(Buffer.concat(chunks).toString()));
      });
      return;
    }
    res.writeHead(404); res.end();
  });

  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}/sse`,
        close: () => new Promise<void>((r) => {
          for (const t of transports.values()) t.close().catch(() => {});
          httpServer.close(() => r());
        }),
      });
    });
  });
}

// ── Config helpers ────────────────────────────────────────────────────

function makeSseConfig(url: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'a9-sse-' + Date.now() + Math.random(),
    workspace_id: 'test-workspace',
    name: 'a9-sse',
    transport: 'sse',
    url,
    enabled: true,
    timeout: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeStdioConfig(tmpDir: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'a9-stdio-' + Date.now() + Math.random(),
    workspace_id: 'test-workspace',
    name: 'a9-stdio',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
    env: {},
    enabled: true,
    timeout: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Mock Supabase for AgentToolExecutor ──────────────────────────────

const TASK_IN_PROGRESS = {
  id: 'task-a9',
  title: 'A9 integration task',
  status: 'in-progress',
  assigned_agent_id: 'agent-a9',
  required_skills: ['filesystem'],
};

function createMockSupabase(overrides: {
  taskData?: Record<string, unknown> | null;
  serverData?: Record<string, unknown> | null;
  serversData?: Record<string, unknown>[] | null;
  atomicUpdateReturns?: Record<string, unknown> | null;
}) {
  const atomicResult = overrides.atomicUpdateReturns !== undefined
    ? overrides.atomicUpdateReturns
    : (overrides.taskData ? { id: (overrides.taskData as Record<string, unknown>).id } : null);

  function makeChain(table: string, isUpdate: boolean) {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.select = () => chain;
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    chain.single = () => {
      if (table === 'task_queue') return Promise.resolve({ data: overrides.taskData ?? null, error: null });
      if (table === 'mcp_servers') return Promise.resolve({ data: overrides.serverData ?? null, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    chain.maybeSingle = () => {
      if (table === 'task_queue' && isUpdate) return Promise.resolve({ data: atomicResult, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    return chain;
  }

  return {
    from: (table: string) => {
      const base = makeChain(table, false);
      return {
        ...base,
        select: (_cols: string) => {
          const sc = makeChain(table, false);
          if (table === 'mcp_servers') {
            const eqHandler = () => ({
              ...sc,
              eq: () => ({
                ...sc,
                then: (resolve: (v: unknown) => void) =>
                  resolve({ data: overrides.serversData ?? [], error: null }),
              }),
            });
            return { ...sc, eq: eqHandler };
          }
          return sc;
        },
        update: () => makeChain(table, true),
      };
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

let sseServer: { url: string; close: () => Promise<void> };
let tmpDir: string;

beforeAll(async () => {
  sseServer = await startSSEServer();
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-a9-')));
});

afterAll(async () => {
  await sseServer.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('A9: End-to-end agent→MCP integration', () => {
  // ── Scenario 1: discover→execute happy path ──────────────────────
  test('1. agent discovers tools then executes via AgentToolExecutor (SSE)', async () => {
    const serverConfig = makeSseConfig(sseServer.url);
    const registry = new MCPServerRegistry();
    await registry.addServer(serverConfig);

    const supabase = createMockSupabase({
      taskData: TASK_IN_PROGRESS,
      atomicUpdateReturns: { id: 'task-a9' },
      serverData: {
        id: serverConfig.id,
        name: serverConfig.name,
        workspace_id: 'test-workspace',
        enabled: true,
      },
      serversData: [serverConfig as unknown as Record<string, unknown>],
    });
    const executor = new AgentToolExecutor(supabase as never, registry);

    // Step 1: discover
    const tools = await executor.discoverTools('test-workspace');
    expect(tools.length).toBeGreaterThan(0);
    const echoTool = tools.find(t => t.name === 'echo');
    expect(echoTool).toBeDefined();

    // Step 2: execute
    const result = await executor.executeTool(
      { taskId: 'task-a9', agentId: 'agent-a9', workspaceId: 'test-workspace' },
      { serverId: serverConfig.id, toolName: 'echo', arguments: { message: 'e2e test' } },
    );
    expect(result.success).toBe(true);
    expect(result.content?.[0]?.text).toBe('echo: e2e test');
    expect(result.toolName).toBe('echo');

    await registry.disconnectAll();
  });

  // ── Scenario 2: tool not found ────────────────────────────────────
  test('2. tool not found returns error result (not exception)', async () => {
    const serverConfig = makeSseConfig(sseServer.url);
    const registry = new MCPServerRegistry();
    await registry.addServer(serverConfig);

    const supabase = createMockSupabase({
      taskData: TASK_IN_PROGRESS,
      atomicUpdateReturns: { id: 'task-a9' },
      serverData: {
        id: serverConfig.id,
        name: serverConfig.name,
        workspace_id: 'test-workspace',
        enabled: true,
      },
    });
    const executor = new AgentToolExecutor(supabase as never, registry);

    const result = await executor.executeTool(
      { taskId: 'task-a9', agentId: 'agent-a9', workspaceId: 'test-workspace' },
      { serverId: serverConfig.id, toolName: 'nonexistent_tool', arguments: {} },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    await registry.disconnectAll();
  });

  // ── Scenario 3: server unavailable / connection refused ────────────
  test('3. server unavailable throws on connect (SSE)', async () => {
    const config = makeSseConfig('http://127.0.0.1:1/sse', { timeout: 2000 });
    const client = new MCPClient(config);

    await expect(client.connect()).rejects.toThrow();
    expect(client.isConnected()).toBe(false);
  });

  test('3b. server unavailable throws on connect (stdio)', async () => {
    const config = makeStdioConfig(tmpDir, {
      command: 'nonexistent-binary-xyz',
      args: [],
    });
    const client = new MCPClient(config);

    await expect(client.connect()).rejects.toThrow();
    expect(client.isConnected()).toBe(false);
  });

  // ── Scenario 4: timeout ────────────────────────────────────────────
  test('4. tool execution respects timeout (SSE)', async () => {
    // Use a 500ms timeout against a tool that sleeps 10000ms
    // With 3 retries + exponential backoff (1s, 2s), total ≈ 500*3 + 1000 + 2000 = 4500ms
    // Key assertion: completes well before 3 × 10000ms = 30s (what would happen without timeout)
    const config = makeSseConfig(sseServer.url, { timeout: 500 });
    const client = new MCPClient(config);
    await client.connect();

    const start = Date.now();
    const result = await client.callTool('slow', { ms: 10000 });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect(elapsed).toBeLessThan(10000); // must be way under the 10s sleep
    expect(result.error).toContain('timeout');

    await client.disconnect();
  });

  // ── Scenario 5: circuit breaker opens after repeated failures ──────
  test('5. circuit breaker opens after 5 consecutive failures', async () => {
    const config = makeSseConfig(sseServer.url, { timeout: 200 });
    const client = new MCPClient(config);
    await client.connect();

    // Trigger 5 failures (tool that sleeps longer than timeout)
    for (let i = 0; i < 5; i++) {
      const result = await client.callTool('slow', { ms: 5000 });
      expect(result.success).toBe(false);
    }

    const state = client.getCircuitBreakerState();
    expect(state.state).toBe('open');
    expect(state.failures).toBeGreaterThanOrEqual(5);

    // Next call should throw circuit breaker error immediately
    await expect(
      (async () => {
        // callTool checks circuit breaker synchronously before any I/O
        return client.callTool('echo', { message: 'should fail fast' });
      })(),
    ).rejects.toThrow(/Circuit breaker OPEN/);

    await client.disconnect();
  });

  // ── Scenario 6: SSE connect success ────────────────────────────────
  test('6. SSE connect + listTools + callTool full flow', async () => {
    const client = new MCPClient(makeSseConfig(sseServer.url));
    await client.connect();
    expect(client.isConnected()).toBe(true);

    const tools = await client.listTools();
    expect(tools.map(t => t.name)).toContain('echo');
    expect(tools.map(t => t.name)).toContain('add');

    const result = await client.callTool('add', { a: 100, b: 200 });
    expect(result.success).toBe(true);
    expect(result.content?.[0]?.text).toBe('300');

    await client.disconnect();
  });

  // ── Scenario 7: SSE disconnect cleanup ─────────────────────────────
  test('7. SSE disconnect clears state and allows reconnect', async () => {
    const config = makeSseConfig(sseServer.url);
    const client = new MCPClient(config);

    await client.connect();
    const tools1 = await client.listTools();
    expect(tools1.length).toBeGreaterThan(0);

    await client.disconnect();
    expect(client.isConnected()).toBe(false);

    // Reconnect — should work clean
    await client.connect();
    const tools2 = await client.listTools(true); // force refresh to prove new connection
    expect(tools2.length).toBe(tools1.length);

    await client.disconnect();
  });

  // ── Scenario 8: SSE reconnect on drop ──────────────────────────────
  test('8. SSE auto-reconnects on callTool after disconnect', async () => {
    const config = makeSseConfig(sseServer.url);
    const client = new MCPClient(config);

    await client.connect();
    const r1 = await client.callTool('echo', { message: 'before' });
    expect(r1.success).toBe(true);

    // Force disconnect to simulate drop
    await client.disconnect();
    expect(client.isConnected()).toBe(false);

    // callTool should auto-reconnect via ensureConnected
    const r2 = await client.callTool('echo', { message: 'after reconnect' });
    expect(r2.success).toBe(true);
    expect(r2.content?.[0]?.text).toBe('echo: after reconnect');
    expect(client.isConnected()).toBe(true);

    await client.disconnect();
  });

  // ── Scenario 9: stdio parity end-to-end ────────────────────────────
  test('9. stdio end-to-end: registry discover + execute (parity with SSE)', async () => {
    const stdioConfig = makeStdioConfig(tmpDir);
    const sseConfig = makeSseConfig(sseServer.url);

    const stdioRegistry = new MCPServerRegistry();
    const sseRegistry = new MCPServerRegistry();

    await stdioRegistry.addServer(stdioConfig);
    await sseRegistry.addServer(sseConfig);

    // Both: list tools
    const stdioTools = await stdioRegistry.listTools(stdioConfig.id);
    const sseTools = await sseRegistry.listTools(sseConfig.id);
    expect(stdioTools.length).toBeGreaterThan(0);
    expect(sseTools.length).toBeGreaterThan(0);

    // Stdio: write + read
    fs.writeFileSync(path.join(tmpDir, 'parity-a9.txt'), 'parity content');
    const stdioResult = await stdioRegistry.callTool(
      stdioConfig.id, 'read_file', { path: path.join(tmpDir, 'parity-a9.txt') },
    );
    expect(stdioResult.success).toBe(true);
    expect(stdioResult.content?.[0]?.text).toContain('parity content');

    // SSE: echo
    const sseResult = await sseRegistry.callTool(sseConfig.id, 'echo', { message: 'parity content' });
    expect(sseResult.success).toBe(true);
    expect(sseResult.content?.[0]?.text).toContain('parity content');

    // Both results have identical shape
    expect(Object.keys(stdioResult).sort()).toEqual(Object.keys(sseResult).sort());

    await stdioRegistry.disconnectAll();
    await sseRegistry.disconnectAll();
  });

  // ── Scenario 10: invalid args validation error ─────────────────────
  test('10. invalid arguments returns error (not crash)', async () => {
    const config = makeSseConfig(sseServer.url);
    const client = new MCPClient(config);
    await client.connect();

    // 'add' requires {a: number, b: number}, pass strings
    const result = await client.callTool('add', { a: 'not-a-number', b: 'also-not' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    await client.disconnect();
  });

  // ── Bonus: AgentToolExecutor rejects wrong workspace server ────────
  test('11. executor rejects server from wrong workspace', async () => {
    const registry = new MCPServerRegistry();
    const supabase = createMockSupabase({
      taskData: TASK_IN_PROGRESS,
      atomicUpdateReturns: { id: 'task-a9' },
      serverData: {
        id: 'foreign-server',
        name: 'foreign',
        workspace_id: 'other-workspace',
        enabled: true,
      },
    });
    const executor = new AgentToolExecutor(supabase as never, registry);

    try {
      await executor.executeTool(
        { taskId: 'task-a9', agentId: 'agent-a9', workspaceId: 'test-workspace' },
        { serverId: 'foreign-server', toolName: 'echo', arguments: { message: 'x' } },
      );
      fail('Expected AgentToolError');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentToolError);
      expect((err as AgentToolError).code).toBe('server_not_in_workspace');
    }

    await registry.disconnectAll();
  });

  // ── Bonus: tool that returns isError flag ──────────────────────────
  test('12. tool returning isError=true surfaces as success=false', async () => {
    const client = new MCPClient(makeSseConfig(sseServer.url));
    await client.connect();

    const result = await client.callTool('fail', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    await client.disconnect();
  });
});
