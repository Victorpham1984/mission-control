/**
 * MCP Integration Tests - End-to-end registry workflows
 */

import { MCPServerRegistry } from '../MCPServerRegistry';
import type { MCPServerConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeConfig(tmpDir: string, name = 'integration-fs'): MCPServerConfig {
  return {
    id: `int-${name}-${Date.now()}`,
    workspace_id: 'test',
    name,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', tmpDir],
    env: {},
    enabled: true,
    timeout: 15000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

let tmpDir: string;
let registry: MCPServerRegistry;

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-int-')));
  registry = new MCPServerRegistry();
});

afterEach(async () => {
  await registry.disconnectAll();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MCP Integration Tests', () => {
  test('full workflow: add server → discover → execute → verify', async () => {
    const config = makeConfig(tmpDir);
    const serverId = await registry.addServer(config);
    expect(serverId).toBe(config.id);

    // Discover tools
    const tools = await registry.listTools(serverId);
    expect(tools.length).toBeGreaterThan(5);
    expect(tools.map(t => t.name)).toContain('read_file');

    // Execute tool
    const testPath = path.join(tmpDir, 'integration.txt');
    const writeResult = await registry.callTool(serverId, 'write_file', {
      path: testPath,
      content: 'integration test content',
    });
    expect(writeResult.success).toBe(true);

    // Verify
    const readResult = await registry.callTool(serverId, 'read_file', {
      path: testPath,
    });
    expect(readResult.success).toBe(true);
    expect(readResult.content?.[0]?.text).toContain('integration test content');
  });

  test('multi-server scenario: 2 servers with isolated directories', async () => {
    const dir1 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ms1-')));
    const dir2 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ms2-')));

    try {
      const config1 = makeConfig(dir1, 'server-1');
      const config2 = makeConfig(dir2, 'server-2');

      const id1 = await registry.addServer(config1);
      const id2 = await registry.addServer(config2);

      expect(registry.size).toBe(2);

      // Write to server 1's directory
      await registry.callTool(id1, 'write_file', {
        path: path.join(dir1, 'from-server1.txt'),
        content: 'written by server 1',
      });

      // Write to server 2's directory
      await registry.callTool(id2, 'write_file', {
        path: path.join(dir2, 'from-server2.txt'),
        content: 'written by server 2',
      });

      // Each server can read its own files
      const r1 = await registry.callTool(id1, 'read_file', {
        path: path.join(dir1, 'from-server1.txt'),
      });
      expect(r1.success).toBe(true);

      const r2 = await registry.callTool(id2, 'read_file', {
        path: path.join(dir2, 'from-server2.txt'),
      });
      expect(r2.success).toBe(true);

      // Server 1 cannot access server 2's files (isolation)
      const cross = await registry.callTool(id1, 'read_file', {
        path: path.join(dir2, 'from-server2.txt'),
      });
      expect(cross.success).toBe(false);

      // List all tools from both servers
      const allTools = await registry.listAllTools();
      expect(allTools.length).toBeGreaterThan(10); // 2 servers × 5+ tools each
      const serverNames = [...new Set(allTools.map(t => t.serverName))];
      expect(serverNames).toContain('server-1');
      expect(serverNames).toContain('server-2');
    } finally {
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });

  test('server removal cleans up connections', async () => {
    const config = makeConfig(tmpDir, 'to-remove');
    const serverId = await registry.addServer(config);

    // Execute to establish connection
    const tools = await registry.listTools(serverId);
    expect(tools.length).toBeGreaterThan(0);

    // Remove server
    await registry.removeServer(serverId);
    expect(registry.size).toBe(0);

    // Trying to use removed server throws
    await expect(registry.listTools(serverId)).rejects.toThrow('not found');
    await expect(
      registry.callTool(serverId, 'read_file', { path: '/tmp/x' }),
    ).rejects.toThrow('not found');
  });

  test('duplicate server registration throws', async () => {
    const config = makeConfig(tmpDir);
    await registry.addServer(config);
    await expect(registry.addServer(config)).rejects.toThrow('already registered');
  });

  test('getStatuses reports correct state', async () => {
    const config = makeConfig(tmpDir, 'status-test');
    const serverId = await registry.addServer(config);

    // Before connection
    let statuses = await registry.getStatuses();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].name).toBe('status-test');

    // After tool discovery (triggers connection)
    await registry.listTools(serverId);
    statuses = await registry.getStatuses();
    expect(statuses[0].connected).toBe(true);
    expect(statuses[0].healthy).toBe(true);
    expect(statuses[0].toolCount).toBeGreaterThan(0);
  });

  test('disconnectAll cleans up everything', async () => {
    const dir1 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-da1-')));
    const dir2 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-da2-')));

    try {
      await registry.addServer(makeConfig(dir1, 'da-1'));
      await registry.addServer(makeConfig(dir2, 'da-2'));
      expect(registry.size).toBe(2);

      await registry.disconnectAll();
      expect(registry.size).toBe(0);
    } finally {
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });

  test('callTool on nonexistent server throws', async () => {
    await expect(
      registry.callTool('nonexistent-id', 'read_file', {}),
    ).rejects.toThrow('not found');
  });
});
