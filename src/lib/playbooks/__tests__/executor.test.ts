/**
 * PlaybookExecutor + ActionLogger tests
 */

import { PlaybookExecutor, PlaybookExecutorError } from '../executor';
import { ActionLogger } from '../action-logger';

// ── Mock Supabase ─────────────────────────────────────────────────────

const SHOPEE_STEPS = [
  { order: 1, action: 'pull_orders', agent_skill: 'order-processing', trigger: 'schedule', requires_approval: false, config: { source: 'shopee_api' } },
  { order: 2, action: 'classify_orders', agent_skill: 'order-processing', trigger: 'after_step_1', requires_approval: false, config: {} },
  { order: 3, action: 'fulfill_orders', agent_skill: 'order-processing', trigger: 'after_step_2', requires_approval: true, config: {} },
];

const PLAYBOOK = {
  id: 'pb-1',
  name: 'Shopee Auto-Order',
  config: { steps: SHOPEE_STEPS, default_agents: 2 },
};

const INSTALLED = {
  id: 'ip-1',
  company_id: 'co-1',
  playbook_id: 'pb-1',
  customization: {},
  active: true,
  run_count: 0,
};

const COMPANY = {
  id: 'co-1',
  workspace_id: 'ws-1',
};

let taskInserts: Array<Record<string, unknown>> = [];
let actionInserts: Array<Record<string, unknown>> = [];
let updates: Array<{ table: string; data: Record<string, unknown> }> = [];

function createMockSupabase(overrides: {
  installed?: Record<string, unknown> | null;
  playbook?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  inFlightCount?: number;
  taskForAction?: Record<string, unknown> | null;
  installedForAction?: Record<string, unknown> | null;
} = {}) {
  taskInserts = [];
  actionInserts = [];
  updates = [];

  let taskCounter = 0;

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.in = () => chain;
    chain.contains = () => chain;
    chain.limit = () => chain;
    chain.select = (_cols?: string, _opts?: unknown) => chain;
    chain.single = () => {
      if (table === 'installed_playbooks' && overrides.installedForAction !== undefined) {
        return Promise.resolve({ data: overrides.installedForAction, error: null });
      }
      if (table === 'installed_playbooks') {
        const val = 'installed' in overrides ? overrides.installed : INSTALLED;
        return Promise.resolve({ data: val, error: null });
      }
      if (table === 'playbooks') {
        const val = 'playbook' in overrides ? overrides.playbook : PLAYBOOK;
        return Promise.resolve({ data: val, error: null });
      }
      if (table === 'companies') {
        const val = 'company' in overrides ? overrides.company : COMPANY;
        return Promise.resolve({ data: val, error: null });
      }
      if (table === 'task_queue') return Promise.resolve({ data: overrides.taskForAction ?? null, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null, count: overrides.inFlightCount ?? 0 });
    chain.insert = (data: Record<string, unknown>) => {
      if (table === 'task_queue') {
        taskCounter++;
        taskInserts.push(data);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: `task-${taskCounter}` }, error: null }),
          }),
        };
      }
      if (table === 'actions') {
        actionInserts.push(data);
        return Promise.resolve({ data: null, error: null });
      }
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'x' }, error: null }) }) };
    };
    chain.update = (data: Record<string, unknown>) => {
      updates.push({ table, data });
      return chain;
    };
    return chain;
  }

  return {
    from: (table: string) => makeChain(table),
  };
}

// ── PlaybookExecutor Tests ────────────────────────────────────────────

describe('PlaybookExecutor', () => {
  test('creates tasks from 3-step playbook config', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);

    const result = await executor.run('ip-1', 'ws-1');

    expect(result.tasksCreated).toBe(3);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].action).toBe('pull_orders');
    expect(result.steps[1].action).toBe('classify_orders');
    expect(result.steps[2].action).toBe('fulfill_orders');
    expect(result.runId).toBeDefined();
    expect(result.playbookName).toBe('Shopee Auto-Order');
  });

  test('task metadata contains run_id + step_order', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);

    const result = await executor.run('ip-1', 'ws-1');

    expect(taskInserts).toHaveLength(3);
    const meta0 = taskInserts[0].metadata as Record<string, unknown>;
    expect(meta0.playbook_run_id).toBe(result.runId);
    expect(meta0.step_order).toBe(1);
    expect(meta0.step_action).toBe('pull_orders');
    expect(meta0.installed_playbook_id).toBe('ip-1');
    expect(meta0.playbook_id).toBe('pb-1');
    expect(meta0.playbook_name).toBe('Shopee Auto-Order');

    const meta2 = taskInserts[2].metadata as Record<string, unknown>;
    expect(meta2.step_order).toBe(3);
    expect(meta2.step_action).toBe('fulfill_orders');
  });

  test('task has correct fields: title, type, required_skills, needs_approval', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);

    await executor.run('ip-1', 'ws-1');

    const task0 = taskInserts[0];
    expect(task0.title).toContain('pull_orders');
    expect(task0.type).toBe('pull_orders');
    expect(task0.required_skills).toEqual(['order-processing']);
    expect(task0.needs_approval).toBe(false);
    expect(task0.workspace_id).toBe('ws-1');

    const task2 = taskInserts[2];
    expect(task2.needs_approval).toBe(true);
  });

  test('increments run_count and sets last_run_at', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);

    await executor.run('ip-1', 'ws-1');

    const ipUpdate = updates.find(u => u.table === 'installed_playbooks');
    expect(ipUpdate).toBeDefined();
    expect(ipUpdate!.data.run_count).toBe(1);
    expect(ipUpdate!.data.last_run_at).toBeDefined();
  });

  test('rejects inactive playbook', async () => {
    const supabase = createMockSupabase({
      installed: { ...INSTALLED, active: false },
    });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-1', 'ws-1')).rejects.toThrow('inactive');
  });

  test('rejects non-existent installed playbook', async () => {
    const supabase = createMockSupabase({ installed: null });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-999', 'ws-1')).rejects.toThrow(PlaybookExecutorError);
  });

  test('rejects when tasks are in-flight (idempotency guard)', async () => {
    const supabase = createMockSupabase({ inFlightCount: 3 });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-1', 'ws-1')).rejects.toThrow('3 in-flight');
  });

  test('rejects playbook with no steps', async () => {
    const supabase = createMockSupabase({
      playbook: { id: 'pb-1', name: 'Empty', config: { steps: [] } },
    });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-1', 'ws-1')).rejects.toThrow('no steps');
  });

  test('rejects company from wrong workspace', async () => {
    const supabase = createMockSupabase({
      company: { id: 'co-1', workspace_id: 'other-ws' },
    });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-1', 'ws-1')).rejects.toThrow(PlaybookExecutorError);
  });
});

// ── ActionLogger Tests ────────────────────────────────────────────────

describe('ActionLogger', () => {
  test('logs action for playbook task on success', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-1',
        type: 'pull_orders',
        title: 'Pull orders',
        metadata: {
          installed_playbook_id: 'ip-1',
          playbook_run_id: 'run-1',
          step_order: 1,
          step_action: 'pull_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-1', 'ws-1', { orders: 12 }, true, 2500);

    expect(actionInserts).toHaveLength(1);
    const action = actionInserts[0];
    expect(action.company_id).toBe('co-1');
    expect(action.installed_playbook_id).toBe('ip-1');
    expect(action.task_id).toBe('task-1');
    expect(action.action_type).toBe('pull_orders');
    expect(action.success).toBe(true);
    expect(action.duration_ms).toBe(2500);
    expect((action.evidence as Record<string, unknown>).orders).toBe(12);
    expect((action.evidence as Record<string, unknown>).playbook_run_id).toBe('run-1');
  });

  test('logs action on failure with error message', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-1',
        type: 'pull_orders',
        title: 'Pull orders',
        metadata: {
          installed_playbook_id: 'ip-1',
          playbook_run_id: 'run-1',
          step_order: 1,
          step_action: 'pull_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-1', 'ws-1', {}, false, null, 'API timeout');

    expect(actionInserts).toHaveLength(1);
    const action = actionInserts[0];
    expect(action.success).toBe(false);
    expect(action.description).toContain('failed');
    expect(action.description).toContain('API timeout');
    expect((action.evidence as Record<string, unknown>).error).toBe('API timeout');
  });

  test('skips logging for non-playbook tasks', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-1',
        type: 'custom',
        title: 'Manual task',
        metadata: {}, // no installed_playbook_id
      },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-1', 'ws-1', { result: 'done' }, true, 1000);

    expect(actionInserts).toHaveLength(0);
  });

  test('hasPlaybookMetadata correctly identifies playbook tasks', () => {
    expect(ActionLogger.hasPlaybookMetadata(null)).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({})).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({ foo: 'bar' })).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({
      installed_playbook_id: 'ip-1',
      playbook_run_id: 'run-1',
    })).toBe(true);
  });
});
