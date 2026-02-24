/**
 * MCPClient unit tests - Tests core MCP client functionality
 * Uses the @modelcontextprotocol/server-filesystem for real integration testing
 */

import { MCPClient } from '../MCPClient';
import type { MCPServerConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper to create a filesystem server config pointing at a temp dir
function makeFilesystemConfig(allowedDir: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'test-fs-' + Date.now(),
    workspace_id: 'test-workspace',
    name: 'test-filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', allowedDir],
    env: {},
    enabled: true,
    timeout: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-')));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MCPClient', () => {
  describe('Connection', () => {
    test('connects to filesystem server successfully', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    test('listTools returns filesystem tools', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
      await client.disconnect();
    });

    test('listTools uses cache on second call', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();
      const tools1 = await client.listTools();
      const start = Date.now();
      const tools2 = await client.listTools();
      const elapsed = Date.now() - start;
      expect(tools2).toEqual(tools1);
      expect(elapsed).toBeLessThan(5); // cached = nearly instant
      await client.disconnect();
    });

    test('double connect is idempotent', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();
      await client.connect(); // should not throw
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
    });

    test('disconnect without connect is safe', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.disconnect(); // should not throw
    });
  });

  describe('Tool Execution', () => {
    test('write_file and read_file round-trip', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();

      const testFile = path.join(tmpDir, 'test.txt');
      const content = 'Hello from MCP test!';

      const writeResult = await client.callTool('write_file', {
        path: testFile,
        content,
      });
      expect(writeResult.success).toBe(true);

      const readResult = await client.callTool('read_file', {
        path: testFile,
      });
      expect(readResult.success).toBe(true);
      expect(readResult.content?.[0]?.text).toContain(content);
      expect(readResult.durationMs).toBeLessThan(5000);

      await client.disconnect();
    });

    test('list_directory works', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();

      // Create some files
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
      fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');

      const result = await client.callTool('list_directory', {
        path: tmpDir,
      });
      expect(result.success).toBe(true);
      const text = result.content?.[0]?.text ?? '';
      expect(text).toContain('a.txt');
      expect(text).toContain('b.txt');

      await client.disconnect();
    });

    test('auto-connects on callTool if not connected', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      // Don't call connect()
      fs.writeFileSync(path.join(tmpDir, 'auto.txt'), 'auto');

      const result = await client.callTool('read_file', {
        path: path.join(tmpDir, 'auto.txt'),
      });
      expect(result.success).toBe(true);
      expect(client.isConnected()).toBe(true);
      await client.disconnect();
    });

    test('reports duration in result', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();

      fs.writeFileSync(path.join(tmpDir, 'dur.txt'), 'test');
      const result = await client.callTool('read_file', {
        path: path.join(tmpDir, 'dur.txt'),
      });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(10000);

      await client.disconnect();
    });
  });

  describe('Error Handling', () => {
    test('returns error for invalid command', async () => {
      const config = makeFilesystemConfig(tmpDir, {
        command: 'nonexistent-command-xyz',
        args: [],
      });
      const client = new MCPClient(config);

      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    test('returns error for missing transport', async () => {
      const config = makeFilesystemConfig(tmpDir, {
        transport: 'sse' as any,
      });
      const client = new MCPClient(config);
      await expect(client.connect()).rejects.toThrow('not yet supported');
    });

    test('enriches error with server/tool context', async () => {
      const client = new MCPClient(makeFilesystemConfig(tmpDir));
      await client.connect();

      // Try to read a file outside allowed directory
      const result = await client.callTool('read_file', {
        path: '/etc/shadow',
      });
      // Should fail (permission denied or path error)
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      await client.disconnect();
    });
  });
});
