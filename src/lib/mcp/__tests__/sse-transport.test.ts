/**
 * SSE Transport tests - MCPClient SSE transport + stdio parity
 *
 * Spins up a real MCP server with SSEServerTransport on a local HTTP port,
 * then connects MCPClient via SSE transport. Verifies:
 *   1. SSE connect/disconnect/cleanup
 *   2. Tool discovery via SSE
 *   3. Tool execution via SSE
 *   4. Parity: same operations produce equivalent results on stdio and SSE
 *   5. Error handling: connection refused, timeout, invalid URL
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { MCPClient } from '../MCPClient';
import type { MCPServerConfig } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────

/** Create an in-process MCP server with echo + add tools */
function createTestMCPServer(): McpServer {
  const server = new McpServer(
    { name: 'test-sse-server', version: '1.0.0' },
  );

  server.tool(
    'echo',
    'Echoes back the input message',
    { message: z.string() },
    async ({ message }) => ({
      content: [{ type: 'text' as const, text: `echo: ${message}` }],
    }),
  );

  server.tool(
    'add',
    'Adds two numbers',
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: 'text' as const, text: String(a + b) }],
    }),
  );

  return server;
}

/** Start HTTP server hosting SSE MCP transport, returns { url, close } */
async function startSSEServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', `http://localhost`);

    if (reqUrl.pathname === '/sse' && req.method === 'GET') {
      // Create a fresh McpServer per SSE session (SDK limitation: 1 transport per server)
      const mcpServer = createTestMCPServer();
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      await mcpServer.connect(transport);
      return;
    }

    if (reqUrl.pathname === '/messages' && req.method === 'POST') {
      const sessionId = reqUrl.searchParams.get('sessionId');
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(400);
        res.end('Unknown session');
        return;
      }
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        await transport.handlePostMessage(req, res, body);
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}/sse`,
        close: () => new Promise<void>((r) => {
          for (const t of transports.values()) {
            t.close().catch(() => {});
          }
          httpServer.close(() => r());
        }),
      });
    });
  });
}

function makeSseConfig(url: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'test-sse-' + Date.now(),
    workspace_id: 'test-workspace',
    name: 'test-sse',
    transport: 'sse',
    url,
    enabled: true,
    timeout: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeStdioConfig(tmpDir: string): MCPServerConfig {
  return {
    id: 'test-stdio-' + Date.now(),
    workspace_id: 'test-workspace',
    name: 'test-stdio',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
    env: {},
    enabled: true,
    timeout: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('SSE Transport', () => {
  let sseServer: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    sseServer = await startSSEServer();
  });

  afterAll(async () => {
    await sseServer.close();
  });

  describe('Connection', () => {
    test('connects to SSE server successfully', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    test('double connect is idempotent', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      await client.connect(); // should not throw
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
    });

    test('disconnect without connect is safe', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.disconnect(); // should not throw
    });

    test('disconnect cleans up resources', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      // Verify can reconnect after disconnect
      await client.connect();
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
    });
  });

  describe('Tool Discovery', () => {
    test('listTools returns tools from SSE server', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      const tools = await client.listTools();
      expect(tools.length).toBe(2);
      const names = tools.map(t => t.name);
      expect(names).toContain('echo');
      expect(names).toContain('add');
      await client.disconnect();
    });

    test('listTools uses cache on second call', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      const tools1 = await client.listTools();
      const start = Date.now();
      const tools2 = await client.listTools();
      const elapsed = Date.now() - start;
      expect(tools2).toEqual(tools1);
      expect(elapsed).toBeLessThan(5);
      await client.disconnect();
    });
  });

  describe('Tool Execution', () => {
    test('executes echo tool via SSE', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      const result = await client.callTool('echo', { message: 'hello SSE' });
      expect(result.success).toBe(true);
      expect(result.content?.[0]?.text).toBe('echo: hello SSE');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      await client.disconnect();
    });

    test('executes add tool via SSE', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      const result = await client.callTool('add', { a: 3, b: 7 });
      expect(result.success).toBe(true);
      expect(result.content?.[0]?.text).toBe('10');
      await client.disconnect();
    });

    test('returns error for unknown tool', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      await client.connect();
      const result = await client.callTool('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      await client.disconnect();
    });

    test('auto-connects on callTool if not connected', async () => {
      const client = new MCPClient(makeSseConfig(sseServer.url));
      // Don't call connect()
      const result = await client.callTool('echo', { message: 'auto' });
      expect(result.success).toBe(true);
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
    });
  });

  describe('Error Handling', () => {
    test('throws on missing URL for SSE config', () => {
      const config = makeSseConfig(sseServer.url, { url: undefined });
      const client = new MCPClient(config);
      expect(client.connect()).rejects.toThrow('No URL specified');
    });

    test('returns error for connection refused (wrong port)', async () => {
      const config = makeSseConfig('http://127.0.0.1:1/sse', { timeout: 2000 });
      const client = new MCPClient(config);
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });
});

describe('Stdio/SSE Parity', () => {
  let sseServer: { url: string; close: () => Promise<void> };
  let tmpDir: string;

  beforeAll(async () => {
    sseServer = await startSSEServer();
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-parity-')));
  });

  afterAll(async () => {
    await sseServer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('both transports: listTools returns structured tool objects', async () => {
    const sseClient = new MCPClient(makeSseConfig(sseServer.url));
    const stdioClient = new MCPClient(makeStdioConfig(tmpDir));

    await sseClient.connect();
    await stdioClient.connect();

    const sseTools = await sseClient.listTools();
    const stdioTools = await stdioClient.listTools();

    // Both return arrays of tools with name, description, inputSchema
    expect(Array.isArray(sseTools)).toBe(true);
    expect(Array.isArray(stdioTools)).toBe(true);
    expect(sseTools.length).toBeGreaterThan(0);
    expect(stdioTools.length).toBeGreaterThan(0);

    // Same structure for each tool
    for (const tool of sseTools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.inputSchema).toBe('object');
    }
    for (const tool of stdioTools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.inputSchema).toBe('object');
    }

    await sseClient.disconnect();
    await stdioClient.disconnect();
  });

  test('both transports: callTool returns MCPToolExecutionResult', async () => {
    const sseClient = new MCPClient(makeSseConfig(sseServer.url));
    const stdioClient = new MCPClient(makeStdioConfig(tmpDir));

    await sseClient.connect();
    await stdioClient.connect();

    // SSE: call echo tool
    const sseResult = await sseClient.callTool('echo', { message: 'parity' });

    // Stdio: write + read file
    fs.writeFileSync(path.join(tmpDir, 'parity.txt'), 'parity');
    const stdioResult = await stdioClient.callTool('read_file', { path: path.join(tmpDir, 'parity.txt') });

    // Both have the same result shape
    expect(typeof sseResult.success).toBe('boolean');
    expect(typeof stdioResult.success).toBe('boolean');
    expect(typeof sseResult.durationMs).toBe('number');
    expect(typeof stdioResult.durationMs).toBe('number');
    expect(Array.isArray(sseResult.content)).toBe(true);
    expect(Array.isArray(stdioResult.content)).toBe(true);

    // Both succeed
    expect(sseResult.success).toBe(true);
    expect(stdioResult.success).toBe(true);

    await sseClient.disconnect();
    await stdioClient.disconnect();
  });

  test('both transports: error results have same shape', async () => {
    const sseClient = new MCPClient(makeSseConfig(sseServer.url));
    const stdioClient = new MCPClient(makeStdioConfig(tmpDir));

    await sseClient.connect();
    await stdioClient.connect();

    // SSE: call unknown tool
    const sseResult = await sseClient.callTool('nonexistent_tool_xyz', {});

    // Stdio: read non-existent file
    const stdioResult = await stdioClient.callTool('read_file', { path: '/nonexistent/path/xyz' });

    // Both have error shape
    expect(sseResult.success).toBe(false);
    expect(stdioResult.success).toBe(false);
    expect(typeof sseResult.durationMs).toBe('number');
    expect(typeof stdioResult.durationMs).toBe('number');
    // Error field present on both
    expect(sseResult.error).toBeDefined();
    expect(stdioResult.error).toBeDefined();

    await sseClient.disconnect();
    await stdioClient.disconnect();
  });

  test('both transports: disconnect + reconnect works', async () => {
    const sseClient = new MCPClient(makeSseConfig(sseServer.url));
    const stdioClient = new MCPClient(makeStdioConfig(tmpDir));

    // Connect
    await sseClient.connect();
    await stdioClient.connect();
    expect(sseClient.isConnected()).toBe(true);
    expect(stdioClient.isConnected()).toBe(true);

    // Disconnect
    await sseClient.disconnect();
    await stdioClient.disconnect();
    expect(sseClient.isConnected()).toBe(false);
    expect(stdioClient.isConnected()).toBe(false);

    // Reconnect
    await sseClient.connect();
    await stdioClient.connect();
    expect(sseClient.isConnected()).toBe(true);
    expect(stdioClient.isConnected()).toBe(true);

    // Tools still work after reconnect
    const sseTools = await sseClient.listTools();
    const stdioTools = await stdioClient.listTools();
    expect(sseTools.length).toBeGreaterThan(0);
    expect(stdioTools.length).toBeGreaterThan(0);

    await sseClient.disconnect();
    await stdioClient.disconnect();
  });
});
