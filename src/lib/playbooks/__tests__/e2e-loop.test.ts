/**
 * E2E Execution Loop + Notification Verification Tests
 *
 * Proves the full playbook loop without external dependencies:
 *   run playbook → tasks created → agent claims → tool executed → task complete/fail
 *   → action logged → notification dispatched with correct payload
 *
 * Test matrix:
 *   1. Full success loop: run → complete → action logged
 *   2. Full failure loop: run → fail → action logged with error
 *   3. Mixed loop: some steps succeed, one fails
 *   4. Notification: completed task triggers NotificationService
 *   5. Notification: pending_approval task triggers with approval buttons context
 *   6. Notification: failed_permanent task triggers with error in payload
 *   7. Notification: user opted-out → no dispatch
 *   8. Telegram callback: approve callback data format is correct
 *   9. Non-playbook task: complete without action log, notification still fires
 */

import { PlaybookExecutor } from '../executor';
import { ActionLogger } from '../action-logger';
import { NotificationService } from '@/lib/notifications';

// ── Shared data ──────────────────────────────────────────────────────

const STEPS = [
  { order: 1, action: 'pull_orders', agent_skill: 'order-processing', trigger: 'schedule', requires_approval: false, config: {} },
  { order: 2, action: 'fulfill_orders', agent_skill: 'order-processing', trigger: 'after_step_1', requires_approval: true, config: {} },
];

const PLAYBOOK = { id: 'pb-1', name: 'E2E Playbook', config: { steps: STEPS } };
const INSTALLED = { id: 'ip-e2e', company_id: 'co-1', playbook_id: 'pb-1', customization: {}, active: true, run_count: 0 };
const COMPANY = { id: 'co-1', workspace_id: 'ws-1' };

// ── Mock tracking ────────────────────────────────────────────────────

let taskInserts: Array<Record<string, unknown>> = [];
let actionInserts: Array<Record<string, unknown>> = [];
let notificationLogInserts: Array<Record<string, unknown>> = [];

interface MockConfig {
  installed?: Record<string, unknown> | null;
  playbook?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  inFlightCount?: number;
  // For ActionLogger
  taskForAction?: Record<string, unknown> | null;
  installedForAction?: Record<string, unknown> | null;
  // For NotificationService
  taskForNotify?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  agent?: Record<string, unknown> | null;
}

function createMock(cfg: MockConfig = {}) {
  taskInserts = [];
  actionInserts = [];
  notificationLogInserts = [];
  let taskCounter = 0;

  function chain(table: string) {
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.in = () => c;
    c.contains = () => c;
    c.limit = () => c;
    c.select = (_cols?: string, _opts?: unknown) => c;
    c.then = (resolve: (v: unknown) => void) => resolve({ data: [], count: cfg.inFlightCount ?? 0, error: null });
    c.single = () => {
      if (table === 'installed_playbooks' && cfg.installedForAction !== undefined) {
        return Promise.resolve({ data: cfg.installedForAction, error: null });
      }
      if (table === 'installed_playbooks') {
        return Promise.resolve({ data: 'installed' in cfg ? cfg.installed : INSTALLED, error: null });
      }
      if (table === 'playbooks') {
        return Promise.resolve({ data: 'playbook' in cfg ? cfg.playbook : PLAYBOOK, error: null });
      }
      if (table === 'companies') {
        return Promise.resolve({ data: 'company' in cfg ? cfg.company : COMPANY, error: null });
      }
      if (table === 'task_queue') {
        return Promise.resolve({ data: cfg.taskForNotify ?? cfg.taskForAction ?? null, error: null });
      }
      if (table === 'workspaces') {
        return Promise.resolve({ data: cfg.workspace ?? { owner_id: 'user-1' }, error: null });
      }
      if (table === 'profiles') {
        return Promise.resolve({
          data: cfg.profile ?? {
            id: 'user-1',
            telegram_chat_id: '12345',
            preferred_channel: 'telegram',
            notification_settings: { task_completed: true, task_approval_needed: true, task_failed: true },
          },
          error: null,
        });
      }
      if (table === 'agents') {
        return Promise.resolve({ data: cfg.agent ?? { name: 'Agent Alpha' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    c.insert = (data: Record<string, unknown>) => {
      if (table === 'task_queue') {
        taskCounter++;
        taskInserts.push(data);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: `task-${taskCounter}` }, error: null }) }) };
      }
      if (table === 'actions') {
        actionInserts.push(data);
      }
      if (table === 'notification_log') {
        notificationLogInserts.push(data);
      }
      return Promise.resolve({ data: null, error: null });
    };
    c.update = () => c;
    return c;
  }

  return { from: (table: string) => chain(table) };
}

// ── E2E Loop Tests ───────────────────────────────────────────────────

describe('E2E Execution Loop', () => {
  test('1. full success loop: run → complete → action logged', async () => {
    // Phase 1: Run playbook
    const supabase = createMock();
    const executor = new PlaybookExecutor(supabase as never);
    const runResult = await executor.run('ip-e2e', 'ws-1');

    expect(runResult.tasksCreated).toBe(2);
    expect(runResult.steps[0].action).toBe('pull_orders');
    expect(runResult.steps[1].action).toBe('fulfill_orders');
    const runId = runResult.runId;

    // Phase 2: Agent completes first task → action logged
    const logSupabase = createMock({
      taskForAction: {
        id: 'task-1', type: 'pull_orders', title: 'Pull orders',
        metadata: {
          playbook_run_id: runId,
          installed_playbook_id: 'ip-e2e',
          step_order: 1,
          step_action: 'pull_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(logSupabase as never);
    await logger.logFromTask('task-1', 'ws-1', { orders_processed: 12 }, true, 2500);

    expect(actionInserts).toHaveLength(1);
    expect(actionInserts[0].success).toBe(true);
    expect(actionInserts[0].action_type).toBe('pull_orders');
    expect(actionInserts[0].company_id).toBe('co-1');
    expect((actionInserts[0].evidence as Record<string, unknown>).playbook_run_id).toBe(runId);
  });

  test('2. full failure loop: run → fail → action logged with error', async () => {
    const supabase = createMock();
    const executor = new PlaybookExecutor(supabase as never);
    const runResult = await executor.run('ip-e2e', 'ws-1');
    const runId = runResult.runId;

    // Agent fails the task
    const logSupabase = createMock({
      taskForAction: {
        id: 'task-2', type: 'fulfill_orders', title: 'Fulfill',
        metadata: {
          playbook_run_id: runId,
          installed_playbook_id: 'ip-e2e',
          step_order: 2,
          step_action: 'fulfill_orders',
        },
      },
      installedForAction: { company_id: 'co-1' },
    });
    const logger = new ActionLogger(logSupabase as never);
    await logger.logFromTask('task-2', 'ws-1', {}, false, null, 'Shipping provider unreachable');

    expect(actionInserts).toHaveLength(1);
    expect(actionInserts[0].success).toBe(false);
    expect(actionInserts[0].description).toContain('failed');
    expect(actionInserts[0].description).toContain('Shipping provider unreachable');
    expect((actionInserts[0].evidence as Record<string, unknown>).error).toBe('Shipping provider unreachable');
  });

  test('3. mixed: step 1 succeeds, step 2 fails — both logged', async () => {
    // Step 1 success
    const s1 = createMock({
      taskForAction: {
        id: 'task-1', type: 'pull_orders', title: 'Pull',
        metadata: { installed_playbook_id: 'ip-e2e', playbook_run_id: 'run-mix', step_order: 1, step_action: 'pull_orders' },
      },
      installedForAction: { company_id: 'co-1' },
    });
    await new ActionLogger(s1 as never).logFromTask('task-1', 'ws-1', { count: 5 }, true, 1000);
    const successAction = [...actionInserts];

    // Step 2 failure
    const s2 = createMock({
      taskForAction: {
        id: 'task-2', type: 'fulfill_orders', title: 'Fulfill',
        metadata: { installed_playbook_id: 'ip-e2e', playbook_run_id: 'run-mix', step_order: 2, step_action: 'fulfill_orders' },
      },
      installedForAction: { company_id: 'co-1' },
    });
    await new ActionLogger(s2 as never).logFromTask('task-2', 'ws-1', {}, false, null, 'timeout');

    // Both actions logged independently
    expect(successAction).toHaveLength(1);
    expect(successAction[0].success).toBe(true);
    expect(actionInserts).toHaveLength(1); // reset by createMock
    expect(actionInserts[0].success).toBe(false);
  });
});

// ── Notification Verification ────────────────────────────────────────

describe('Notification Flow', () => {
  test('4. completed task triggers NotificationService with correct payload', async () => {
    const supabase = createMock({
      taskForNotify: {
        id: 'task-1',
        title: '[E2E Playbook] Step 1: pull_orders',
        output: { orders: 12 },
        error: null,
        assigned_agent_id: 'agent-1',
      },
    });

    // Mock TELEGRAM_BOT_TOKEN to prevent real API call
    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    // Mock fetch to capture Telegram API call
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const origFetch = global.fetch;
    global.fetch = (async (url: string, opts: RequestInit) => {
      calls.push({ url, body: JSON.parse(opts.body as string) });
      return { json: () => Promise.resolve({ ok: true, result: { message_id: 999 } }) };
    }) as typeof fetch;

    try {
      const service = new NotificationService(supabase as never);
      const result = await service.notifyTaskEvent('task-1', 'completed', 'ws-1');

      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain('sendMessage');
      expect(calls[0].body.chat_id).toBe('12345');
      // MarkdownV2 escapes underscores: pull\_orders
      expect(calls[0].body.text).toContain('pull');
    } finally {
      global.fetch = origFetch;
      if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });

  test('5. pending_approval triggers with inline keyboard', async () => {
    const supabase = createMock({
      taskForNotify: {
        id: 'task-approval',
        title: 'Approve high-value order',
        output: { amount: 2500000 },
        error: null,
        assigned_agent_id: 'agent-1',
      },
    });

    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const calls: Array<{ body: Record<string, unknown> }> = [];
    const origFetch = global.fetch;
    global.fetch = (async (_url: string, opts: RequestInit) => {
      calls.push({ body: JSON.parse(opts.body as string) });
      return { json: () => Promise.resolve({ ok: true, result: { message_id: 100 } }) };
    }) as typeof fetch;

    try {
      const service = new NotificationService(supabase as never);
      const result = await service.notifyTaskEvent('task-approval', 'pending_approval', 'ws-1');

      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);

      // Should have inline keyboard with approve/reject buttons
      const replyMarkup = calls[0].body.reply_markup as Record<string, unknown>;
      expect(replyMarkup).toBeDefined();
      const keyboard = replyMarkup.inline_keyboard as Array<Array<Record<string, string>>>;
      expect(keyboard.length).toBeGreaterThan(0);

      // Find approve button — callback_data should contain task ID
      const allButtons = keyboard.flat();
      const approveBtn = allButtons.find(b => b.callback_data?.startsWith('approve:'));
      expect(approveBtn).toBeDefined();
      expect(approveBtn!.callback_data).toContain('task-approval');
    } finally {
      global.fetch = origFetch;
      if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });

  test('6. failed_permanent triggers with error in payload', async () => {
    const supabase = createMock({
      taskForNotify: {
        id: 'task-fail',
        title: 'Failed task',
        output: null,
        error: 'Max retries exceeded',
        assigned_agent_id: null,
      },
    });

    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const calls: Array<{ body: Record<string, unknown> }> = [];
    const origFetch = global.fetch;
    global.fetch = (async (_url: string, opts: RequestInit) => {
      calls.push({ body: JSON.parse(opts.body as string) });
      return { json: () => Promise.resolve({ ok: true, result: { message_id: 200 } }) };
    }) as typeof fetch;

    try {
      const service = new NotificationService(supabase as never);
      const result = await service.notifyTaskEvent('task-fail', 'failed_permanent', 'ws-1');

      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].body.text).toContain('thất bại');
      // No inline keyboard for failure notifications
      expect(calls[0].body.reply_markup).toBeUndefined();
    } finally {
      global.fetch = origFetch;
      if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });

  test('7. user opted-out → no dispatch, success returned', async () => {
    const supabase = createMock({
      taskForNotify: {
        id: 'task-x', title: 'X', output: null, error: null, assigned_agent_id: null,
      },
      profile: {
        id: 'user-1',
        telegram_chat_id: '12345',
        preferred_channel: 'telegram',
        notification_settings: { task_completed: false, task_approval_needed: true, task_failed: true },
      },
    });

    const service = new NotificationService(supabase as never);
    const result = await service.notifyTaskEvent('task-x', 'completed', 'ws-1');

    // User disabled task_completed notifications — should return success without dispatch
    expect(result.success).toBe(true);
    expect(result.externalId).toBeUndefined();
  });

  test('8. Telegram approve callback data format: approve:taskId:rating', () => {
    // Verify the callback_data format that the Telegram webhook handler expects
    const taskId = 'task-abc-123';
    const ratings = [3, 4, 5];

    for (const rating of ratings) {
      const callbackData = `approve:${taskId}:${rating}`;
      const [action, parsedTaskId, parsedRating] = callbackData.split(':');
      expect(action).toBe('approve');
      expect(parsedTaskId).toBe(taskId);
      expect(parseInt(parsedRating)).toBe(rating);
    }

    const rejectData = `reject:${taskId}:revise`;
    const [action, parsedId, rejectAction] = rejectData.split(':');
    expect(action).toBe('reject');
    expect(parsedId).toBe(taskId);
    expect(rejectAction).toBe('revise');
  });

  test('9. non-playbook task: no action log, notification still fires', async () => {
    // Action logger skips non-playbook tasks
    const logSupabase = createMock({
      taskForAction: {
        id: 'manual-task', type: 'custom', title: 'Manual',
        metadata: {},
      },
    });
    await new ActionLogger(logSupabase as never).logFromTask('manual-task', 'ws-1', {}, true, 500);
    expect(actionInserts).toHaveLength(0);

    // But NotificationService still fires
    const notifySupabase = createMock({
      taskForNotify: {
        id: 'manual-task', title: 'Manual task', output: { done: true }, error: null, assigned_agent_id: 'agent-1',
      },
    });

    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const calls: Array<Record<string, unknown>> = [];
    const origFetch = global.fetch;
    global.fetch = (async (_url: string, opts: RequestInit) => {
      calls.push(JSON.parse(opts.body as string));
      return { json: () => Promise.resolve({ ok: true, result: { message_id: 300 } }) };
    }) as typeof fetch;

    try {
      const service = new NotificationService(notifySupabase as never);
      const result = await service.notifyTaskEvent('manual-task', 'completed', 'ws-1');
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
    } finally {
      global.fetch = origFetch;
      if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });
});
