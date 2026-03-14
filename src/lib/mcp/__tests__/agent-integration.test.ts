/**
 * AgentToolExecutor tests - Agent↔MCP tool integration
 * Uses real filesystem MCP server for integration testing (same pattern as mcp-client.test.ts)
 */

import { MCPServerRegistry } from '../MCPServerRegistry';
import { AgentToolExecutor, AgentToolError } from '../agent-integration';
import type { MCPServerConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Mock Supabase client ──────────────────────────────────────────────
//
// Supports two query patterns:
//   1. select chain:  from(t).select(c).eq().eq()...single()
//   2. update chain:  from(t).update(d).eq().eq()...select(c).maybeSingle()
//
// Returns data based on table name and configured overrides.

function createMockSupabase(overrides: {
  taskData?: Record<string, unknown> | null;
  atomicUpdateReturns?: Record<string, unknown> | null; // for executeTool atomic lock
  serversData?: Record<string, unknown>[] | null;
  serverData?: Record<string, unknown> | null;
}) {
  // Default: atomic update returns task id (lock succeeds) unless explicitly set
  const atomicResult = overrides.atomicUpdateReturns !== undefined
    ? overrides.atomicUpdateReturns
    : (overrides.taskData ? { id: (overrides.taskData as Record<string, unknown>).id } : null);

  function makeChain(table: string, isUpdate: boolean) {
    const chain: Record<string, unknown> = {};

    chain.eq = () => chain;
    chain.select = () => chain;
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });

    chain.single = () => {
      if (table === 'task_queue') {
        return Promise.resolve({ data: overrides.taskData ?? null, error: null });
      }
      if (table === 'mcp_servers') {
        return Promise.resolve({ data: overrides.serverData ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    chain.maybeSingle = () => {
      if (table === 'task_queue' && isUpdate) {
        return Promise.resolve({ data: atomicResult, error: null });
      }
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
          const selectChain = makeChain(table, false);

          if (table === 'mcp_servers') {
            // Handle both single-server and multi-server queries
            const eqHandler = () => {
              return {
                ...selectChain,
                eq: (_col2: string, _val2: unknown) => {
                  // Could be workspace_id+enabled (multi) or id (single)
                  return {
                    ...selectChain,
                    // Multi-server query resolves as array
                    then: (resolve: (v: unknown) => void) =>
                      resolve({ data: overrides.serversData ?? [], error: null }),
                  };
                },
              };
            };
            return { ...selectChain, eq: eqHandler };
          }

          return selectChain;
        },
        update: (_data: Record<string, unknown>) => makeChain(table, true),
      };
    },
  };
}

// ── Test helpers ──────────────────────────────────────────────────────

function makeServerConfig(tmpDir: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'test-server-' + Date.now(),
    workspace_id: 'test-workspace',
    name: 'test-filesystem',
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

const VALID_TASK = {
  id: 'task-1',
  title: 'Test task',
  status: 'in-progress',
  assigned_agent_id: 'agent-1',
  required_skills: ['filesystem'],
};

const VALID_CTX = {
  taskId: 'task-1',
  agentId: 'agent-1',
  workspaceId: 'test-workspace',
};

// ── Tests ─────────────────────────────────────────────────────────────

let tmpDir: string;
let registry: MCPServerRegistry;

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-agent-')));
  registry = new MCPServerRegistry();
});

afterEach(async () => {
  await registry.disconnectAll();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('AgentToolExecutor', () => {
  describe('validateTaskOwnership', () => {
    test('succeeds when agent owns in-progress task', async () => {
      const supabase = createMockSupabase({ taskData: VALID_TASK });
      const executor = new AgentToolExecutor(supabase as never, registry);

      const result = await executor.validateTaskOwnership(VALID_CTX);
      expect(result.taskId).toBe('task-1');
      expect(result.requiredSkills).toEqual(['filesystem']);
    });

    test('throws task_not_found when task does not exist', async () => {
      const supabase = createMockSupabase({ taskData: null });
      const executor = new AgentToolExecutor(supabase as never, registry);

      await expect(executor.validateTaskOwnership(VALID_CTX))
        .rejects.toThrow(AgentToolError);

      try {
        await executor.validateTaskOwnership(VALID_CTX);
      } catch (err) {
        expect((err as AgentToolError).code).toBe('task_not_found');
      }
    });

    test('throws invalid_task_status when task is not in-progress', async () => {
      const supabase = createMockSupabase({
        taskData: { ...VALID_TASK, status: 'queued' },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.validateTaskOwnership(VALID_CTX);
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('invalid_task_status');
      }
    });

    test('throws not_assigned when different agent owns task', async () => {
      const supabase = createMockSupabase({
        taskData: { ...VALID_TASK, assigned_agent_id: 'other-agent' },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.validateTaskOwnership(VALID_CTX);
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('not_assigned');
      }
    });
  });

  describe('discoverTools', () => {
    test('returns empty array when no servers configured', async () => {
      const supabase = createMockSupabase({ serversData: [] });
      const executor = new AgentToolExecutor(supabase as never, registry);

      const tools = await executor.discoverTools('test-workspace');
      expect(tools).toEqual([]);
    });

    test('discovers tools from registered MCP server', async () => {
      const serverConfig = makeServerConfig(tmpDir);

      const supabase = createMockSupabase({
        serversData: [serverConfig as unknown as Record<string, unknown>],
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      const tools = await executor.discoverTools('test-workspace');
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');

      // Verify tool structure
      const readFile = tools.find(t => t.name === 'read_file')!;
      expect(readFile.serverId).toBe(serverConfig.id);
      expect(readFile.serverName).toBe('test-filesystem');
      expect(readFile.inputSchema).toBeDefined();
    });
  });

  describe('executeTool', () => {
    test('executes tool successfully via atomic lock', async () => {
      const serverConfig = makeServerConfig(tmpDir);

      fs.writeFileSync(path.join(tmpDir, 'agent-test.txt'), 'hello from agent');

      const supabase = createMockSupabase({
        taskData: VALID_TASK,
        atomicUpdateReturns: { id: 'task-1' },
        serverData: {
          id: serverConfig.id,
          name: serverConfig.name,
          workspace_id: 'test-workspace',
          enabled: true,
        },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      await registry.addServer(serverConfig);

      const result = await executor.executeTool(VALID_CTX, {
        serverId: serverConfig.id,
        toolName: 'read_file',
        arguments: { path: path.join(tmpDir, 'agent-test.txt') },
      });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('read_file');
      expect(result.serverId).toBe(serverConfig.id);
      expect(result.content?.[0]?.text).toContain('hello from agent');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('returns error result for failed tool execution', async () => {
      const serverConfig = makeServerConfig(tmpDir);

      const supabase = createMockSupabase({
        taskData: VALID_TASK,
        atomicUpdateReturns: { id: 'task-1' },
        serverData: {
          id: serverConfig.id,
          name: serverConfig.name,
          workspace_id: 'test-workspace',
          enabled: true,
        },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      await registry.addServer(serverConfig);

      const result = await executor.executeTool(VALID_CTX, {
        serverId: serverConfig.id,
        toolName: 'read_file',
        arguments: { path: path.join(tmpDir, 'nonexistent.txt') },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('falls back to validateTaskOwnership when atomic lock fails', async () => {
      // Simulate race: atomic update returns null (task was reassigned)
      // validateTaskOwnership then checks and finds different agent
      const supabase = createMockSupabase({
        taskData: { ...VALID_TASK, assigned_agent_id: 'other-agent' },
        atomicUpdateReturns: null,
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.executeTool(VALID_CTX, {
          serverId: 'server-1',
          toolName: 'read_file',
          arguments: {},
        });
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('not_assigned');
      }
    });

    test('throws when server not found', async () => {
      const supabase = createMockSupabase({
        taskData: VALID_TASK,
        atomicUpdateReturns: { id: 'task-1' },
        serverData: null,
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.executeTool(VALID_CTX, {
          serverId: 'nonexistent',
          toolName: 'read_file',
          arguments: {},
        });
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('server_not_found');
      }
    });

    test('throws when server belongs to different workspace', async () => {
      const supabase = createMockSupabase({
        taskData: VALID_TASK,
        atomicUpdateReturns: { id: 'task-1' },
        serverData: {
          id: 'server-1',
          name: 'other-server',
          workspace_id: 'other-workspace',
          enabled: true,
        },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.executeTool(VALID_CTX, {
          serverId: 'server-1',
          toolName: 'read_file',
          arguments: {},
        });
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('server_not_in_workspace');
      }
    });

    test('throws when server is disabled', async () => {
      const supabase = createMockSupabase({
        taskData: VALID_TASK,
        atomicUpdateReturns: { id: 'task-1' },
        serverData: {
          id: 'server-1',
          name: 'disabled-server',
          workspace_id: 'test-workspace',
          enabled: false,
        },
      });
      const executor = new AgentToolExecutor(supabase as never, registry);

      try {
        await executor.executeTool(VALID_CTX, {
          serverId: 'server-1',
          toolName: 'read_file',
          arguments: {},
        });
        fail('Expected AgentToolError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentToolError);
        expect((err as AgentToolError).code).toBe('server_disabled');
      }
    });
  });
});
