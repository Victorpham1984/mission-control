/**
 * D2 Hardening Tests — Idempotency, concurrency, metadata regression, action logging
 *
 * Test matrix:
 *   1. Serial double-trigger → second gets 409
 *   2. Parallel trigger race → post-verify catches conflict, cancels losing run
 *   3. Second run allowed after first completes (in-flight count = 0)
 *   4. Metadata regression: every task has playbook_run_id
 *   5. Metadata regression: every task has step_order
 *   6. Metadata regression: every task has step_action
 *   7. Action logger: success path logs correctly
 *   8. Action logger: failure path logs with error
 *   9. Action logger: non-playbook tasks skip logging
 *  10. Action logger: hasPlaybookMetadata guard
 */

import { PlaybookExecutor, PlaybookExecutorError } from '../executor';
import { ActionLogger } from '../action-logger';

// ── Shared test data ──────────────────────────────────────────────────

const STEPS_3 = [
  { order: 1, action: 'pull_orders', agent_skill: 'order-processing', trigger: 'schedule', requires_approval: false, config: {} },
  { order: 2, action: 'classify_orders', agent_skill: 'order-processing', trigger: 'after_step_1', requires_approval: false, config: {} },
  { order: 3, action: 'fulfill_orders', agent_skill: 'order-processing', trigger: 'after_step_2', requires_approval: true, config: { auto_confirm: true } },
];

const PLAYBOOK = { id: 'pb-1', name: 'Shopee Auto-Order', config: { steps: STEPS_3 } };
const INSTALLED = { id: 'ip-1', company_id: 'co-1', playbook_id: 'pb-1', customization: {}, active: true, run_count: 2 };
const COMPANY = { id: 'co-1', workspace_id: 'ws-1' };

// ── Mock factory ──────────────────────────────────────────────────────

let taskInserts: Array<Record<string, unknown>> = [];
let actionInserts: Array<Record<string, unknown>> = [];
let taskUpdates: Array<{ ids: string[]; data: Record<string, unknown> }> = [];
let runCountUpdates: Array<Record<string, unknown>> = [];

interface MockOverrides {
  installed?: Record<string, unknown> | null;
  playbook?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  inFlightCount?: number;
  /** Tasks returned by post-verify conflict check (simulates concurrent run) */
  conflictingTasks?: Array<Record<string, unknown>>;
  taskForAction?: Record<string, unknown> | null;
  installedForAction?: Record<string, unknown> | null;
}

function createMockSupabase(overrides: MockOverrides = {}) {
  taskInserts = [];
  actionInserts = [];
  taskUpdates = [];
  runCountUpdates = [];

  let taskCounter = 0;
  let queryCallCount = 0;

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.in = (_col: string, vals?: string[]) => {
      // Track task cancellation
      if (table === 'task_queue' && vals && vals.length > 0 && typeof vals[0] === 'string') {
        (chain as Record<string, unknown>)._inIds = vals;
      }
      return chain;
    };
    chain.contains = () => chain;
    chain.limit = () => chain;
    chain.select = (_cols?: string, opts?: Record<string, unknown>) => {
      if (opts?.head) {
        // count query — return inFlightCount or 0
        return {
          eq: () => ({
            in: () => ({
              contains: () => Promise.resolve({ count: overrides.inFlightCount ?? 0, data: null, error: null }),
            }),
          }),
        };
      }
      return chain;
    };
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
    chain.then = (resolve: (v: unknown) => void) => {
      // Post-verify conflict check: return conflicting tasks
      if (table === 'task_queue' && overrides.conflictingTasks) {
        queryCallCount++;
        // First call is pre-check (count), subsequent are post-verify (data)
        return resolve({ data: overrides.conflictingTasks, count: overrides.inFlightCount ?? 0, error: null });
      }
      return resolve({ data: [], count: overrides.inFlightCount ?? 0, error: null });
    };
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
      if (table === 'installed_playbooks') {
        runCountUpdates.push(data);
      }
      // Return a chain that captures .in() for task cancellation tracking
      const updateChain: Record<string, unknown> = { ...chain };
      updateChain.in = (_col: string, ids: string[]) => {
        if (table === 'task_queue') {
          taskUpdates.push({ ids, data });
        }
        return chain;
      };
      return updateChain;
    };
    return chain;
  }

  return {
    from: (table: string) => makeChain(table),
  };
}

// ── Idempotency Tests ─────────────────────────────────────────────────

describe('Idempotency', () => {
  test('1. serial double-trigger: second run rejected with 409', async () => {
    // First run: no in-flight tasks
    const supabase1 = createMockSupabase({ inFlightCount: 0 });
    const executor1 = new PlaybookExecutor(supabase1 as never);
    const result = await executor1.run('ip-1', 'ws-1');
    expect(result.tasksCreated).toBe(3);

    // Second run: in-flight tasks exist (simulating first run still active)
    const supabase2 = createMockSupabase({ inFlightCount: 3 });
    const executor2 = new PlaybookExecutor(supabase2 as never);

    await expect(executor2.run('ip-1', 'ws-1')).rejects.toThrow('in-flight');
  });

  test('2. parallel race: post-verify detects conflict and cancels losing run', async () => {
    // Simulate: pre-check passes (0 in-flight), but post-verify finds another run's tasks
    const supabase = createMockSupabase({
      inFlightCount: 0,
      conflictingTasks: [
        { metadata: { installed_playbook_id: 'ip-1', playbook_run_id: 'other-run-id' } },
      ],
    });
    const executor = new PlaybookExecutor(supabase as never);

    await expect(executor.run('ip-1', 'ws-1')).rejects.toThrow('Concurrent run detected');

    // Verify our tasks were cancelled
    expect(taskUpdates.length).toBeGreaterThan(0);
    const cancel = taskUpdates.find(u => (u.data as Record<string, unknown>).status === 'cancelled');
    expect(cancel).toBeDefined();
    expect(cancel!.ids).toHaveLength(3); // 3 tasks cancelled
  });

  test('3. second run succeeds after first run completes', async () => {
    // First run completes — no in-flight tasks
    const supabase = createMockSupabase({ inFlightCount: 0, conflictingTasks: [] });
    const executor = new PlaybookExecutor(supabase as never);

    const result = await executor.run('ip-1', 'ws-1');
    expect(result.tasksCreated).toBe(3);
    expect(result.runId).toBeDefined();

    // run_count should be incremented
    expect(runCountUpdates.length).toBeGreaterThan(0);
    expect(runCountUpdates[0].run_count).toBe(3); // was 2, now 3
  });
});

// ── Metadata Regression Guards ────────────────────────────────────────

describe('Metadata Regression', () => {
  test('4. every task has playbook_run_id', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);
    const result = await executor.run('ip-1', 'ws-1');

    for (const insert of taskInserts) {
      const meta = insert.metadata as Record<string, unknown>;
      expect(meta.playbook_run_id).toBe(result.runId);
      expect(typeof meta.playbook_run_id).toBe('string');
      expect(meta.playbook_run_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  test('5. every task has step_order (sequential integers)', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);
    await executor.run('ip-1', 'ws-1');

    const orders = taskInserts.map(t => (t.metadata as Record<string, unknown>).step_order);
    expect(orders).toEqual([1, 2, 3]);
  });

  test('6. every task has step_action matching config', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);
    await executor.run('ip-1', 'ws-1');

    const actions = taskInserts.map(t => (t.metadata as Record<string, unknown>).step_action);
    expect(actions).toEqual(['pull_orders', 'classify_orders', 'fulfill_orders']);
  });

  test('metadata includes all required fields', async () => {
    const supabase = createMockSupabase();
    const executor = new PlaybookExecutor(supabase as never);
    await executor.run('ip-1', 'ws-1');

    for (const insert of taskInserts) {
      const meta = insert.metadata as Record<string, unknown>;
      expect(meta).toHaveProperty('playbook_run_id');
      expect(meta).toHaveProperty('installed_playbook_id');
      expect(meta).toHaveProperty('playbook_id');
      expect(meta).toHaveProperty('playbook_name');
      expect(meta).toHaveProperty('step_order');
      expect(meta).toHaveProperty('step_action');
      expect(meta).toHaveProperty('step_config');
    }
  });
});

// ── Action Logging Regression Guards ──────────────────────────────────

describe('Action Logging', () => {
  test('7. success path logs action with correct fields', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-1', type: 'pull_orders', title: 'Pull',
        metadata: {
          installed_playbook_id: 'ip-1',
          playbook_run_id: 'run-abc',
          step_order: 1,
          step_action: 'pull_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-1', 'ws-1', { orders: 12 }, true, 3000);

    expect(actionInserts).toHaveLength(1);
    const a = actionInserts[0];
    expect(a.company_id).toBe('co-1');
    expect(a.installed_playbook_id).toBe('ip-1');
    expect(a.task_id).toBe('task-1');
    expect(a.action_type).toBe('pull_orders');
    expect(a.success).toBe(true);
    expect(a.duration_ms).toBe(3000);
    expect(a.description).toContain('completed');
    expect((a.evidence as Record<string, unknown>).playbook_run_id).toBe('run-abc');
    expect((a.evidence as Record<string, unknown>).step_order).toBe(1);
    expect((a.evidence as Record<string, unknown>).orders).toBe(12);
  });

  test('8. failure path logs action with success=false and error', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-2', type: 'fulfill_orders', title: 'Fulfill',
        metadata: {
          installed_playbook_id: 'ip-1',
          playbook_run_id: 'run-xyz',
          step_order: 3,
          step_action: 'fulfill_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-2', 'ws-1', {}, false, null, 'Shipping API timeout');

    expect(actionInserts).toHaveLength(1);
    const a = actionInserts[0];
    expect(a.success).toBe(false);
    expect(a.description).toContain('failed');
    expect(a.description).toContain('Shipping API timeout');
    expect((a.evidence as Record<string, unknown>).error).toBe('Shipping API timeout');
    expect(a.duration_ms).toBeNull();
  });

  test('9. non-playbook tasks skip action logging', async () => {
    const supabase = createMockSupabase({
      taskForAction: {
        id: 'task-manual', type: 'custom', title: 'Manual task',
        metadata: { some: 'other data' },
      },
    });
    const logger = new ActionLogger(supabase as never);

    await logger.logFromTask('task-manual', 'ws-1', { result: 'ok' }, true, 500);

    expect(actionInserts).toHaveLength(0);
  });

  test('10. hasPlaybookMetadata guard is strict', () => {
    expect(ActionLogger.hasPlaybookMetadata(null)).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata(undefined)).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata(42)).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata('string')).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({})).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({ installed_playbook_id: 'x' })).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({ playbook_run_id: 'x' })).toBe(false);
    expect(ActionLogger.hasPlaybookMetadata({
      installed_playbook_id: 'ip-1',
      playbook_run_id: 'run-1',
    })).toBe(true);
  });
});
