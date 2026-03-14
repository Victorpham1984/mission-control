/**
 * Demo: Playbook Execution Loop (end-to-end with mocks)
 *
 * Usage: npx tsx scripts/demo-playbook-loop.ts
 *
 * Simulates the full loop without external dependencies:
 *   1. Install Shopee Auto-Order playbook
 *   2. Run playbook → creates tasks
 *   3. Agent claims + executes MCP tool
 *   4. Agent completes task
 *   5. Action logged
 *   6. Notification dispatched
 */

import { PlaybookExecutor } from '../src/lib/playbooks/executor';
import { ActionLogger } from '../src/lib/playbooks/action-logger';

// ── Colors ────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

function header(msg: string) {
  console.log(`\n${C.bold}${C.cyan}── ${msg} ──${C.reset}`);
}

// ── Mock Supabase ─────────────────────────────────────────────────────

const SHOPEE_STEPS = [
  { order: 1, action: 'pull_orders', agent_skill: 'order-processing', trigger: 'schedule', requires_approval: false, config: { source: 'shopee_api' } },
  { order: 2, action: 'classify_orders', agent_skill: 'order-processing', trigger: 'after_step_1', requires_approval: false, config: {} },
  { order: 3, action: 'fulfill_orders', agent_skill: 'order-processing', trigger: 'after_step_2', requires_approval: true, config: { auto_confirm: true } },
];

let taskCounter = 0;
const createdTasks: Array<{ id: string; metadata: Record<string, unknown> }> = [];
const loggedActions: Array<Record<string, unknown>> = [];

function createDemoSupabase() {
  function chain(table: string) {
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.in = () => c;
    c.contains = () => c;
    c.limit = () => c;
    c.select = () => c;
    c.then = (resolve: (v: unknown) => void) => resolve({ data: [], count: 0, error: null });
    c.single = () => {
      if (table === 'installed_playbooks') {
        return Promise.resolve({
          data: { id: 'ip-demo', company_id: 'co-demo', playbook_id: 'pb-demo', customization: {}, active: true, run_count: 0, company_id_for_action: 'co-demo' },
          error: null,
        });
      }
      if (table === 'playbooks') {
        return Promise.resolve({
          data: { id: 'pb-demo', name: 'Shopee Auto-Order', config: { steps: SHOPEE_STEPS } },
          error: null,
        });
      }
      if (table === 'companies') {
        return Promise.resolve({ data: { id: 'co-demo', workspace_id: 'ws-demo' }, error: null });
      }
      if (table === 'task_queue') {
        // Return the last created task for ActionLogger
        const last = createdTasks[createdTasks.length - 1];
        return Promise.resolve({ data: last ? { id: last.id, type: (last.metadata as Record<string, unknown>).step_action, title: 'Task', metadata: last.metadata } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    c.insert = (data: Record<string, unknown>) => {
      if (table === 'task_queue') {
        taskCounter++;
        const id = `task-${String(taskCounter).padStart(3, '0')}`;
        createdTasks.push({ id, metadata: data.metadata as Record<string, unknown> });
        return { select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }) };
      }
      if (table === 'actions') {
        loggedActions.push(data);
      }
      return Promise.resolve({ data: null, error: null });
    };
    c.update = () => c;
    return c;
  }

  return { from: (table: string) => chain(table) };
}

// ── Demo ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.green}`);
  console.log(`  ╔════════════════════════════════════════════════╗`);
  console.log(`  ║   Playbook Execution Loop — E2E Demo          ║`);
  console.log(`  ╚════════════════════════════════════════════════╝${C.reset}`);

  const supabase = createDemoSupabase();

  // Step 1: Run playbook
  header('Step 1: Run Playbook');
  const executor = new PlaybookExecutor(supabase as never);
  const result = await executor.run('ip-demo', 'ws-demo');

  log('📋', `Playbook: ${C.bold}${result.playbookName}${C.reset}`);
  log('🆔', `Run ID: ${C.dim}${result.runId}${C.reset}`);
  log('📦', `Tasks created: ${result.tasksCreated}`);
  for (const step of result.steps) {
    log('  →', `Step ${step.order}: ${step.action} ${C.dim}(${step.taskId})${C.reset}`);
  }

  // Step 2: Simulate agent claiming + executing
  header('Step 2: Agent Claims + Executes');
  for (const step of result.steps) {
    log('🤖', `Agent claims ${C.bold}${step.action}${C.reset} (${step.taskId})`);
    log('🔧', `Agent executes MCP tool for "${step.action}"`);
  }

  // Step 3: Agent completes task → action logged
  header('Step 3: Task Complete → Action Logged');
  for (const step of result.steps) {
    const task = createdTasks.find(t => t.id === step.taskId)!;
    // Update mock to return this specific task for ActionLogger
    const logSupabase = createDemoSupabase();
    const savedSingle = (logSupabase.from('task_queue') as Record<string, unknown>).single;
    (logSupabase.from('task_queue') as Record<string, unknown>).single = () =>
      Promise.resolve({
        data: { id: task.id, type: task.metadata.step_action, title: `Step ${task.metadata.step_order}`, metadata: task.metadata },
        error: null,
      });

    const logger = new ActionLogger(logSupabase as never);
    const success = step.order !== 99; // All succeed in this demo
    await logger.logFromTask(
      step.taskId,
      'ws-demo',
      { orders_processed: 12, duration: '2.5s' },
      success,
      2500,
    );

    const lastAction = loggedActions[loggedActions.length - 1];
    log(success ? '✅' : '❌', `${step.action}: ${success ? 'success' : 'failed'} → action logged`);
    log('  📊', `Evidence: ${C.dim}${JSON.stringify(lastAction?.evidence ?? {}).slice(0, 80)}${C.reset}`);

    // Restore
    (logSupabase.from('task_queue') as Record<string, unknown>).single = savedSingle;
  }

  // Step 4: Notification summary
  header('Step 4: Notification Dispatched');
  log('🔔', `NotificationService.notifyTaskEvent() would be called`);
  log('📱', `Channel: Telegram (if configured) or Dashboard fallback`);
  log('📨', `Payload: task title, agent name, output preview`);
  log('👆', `For needs_approval tasks: inline keyboard with approve/reject buttons`);

  // Summary
  header('Summary');
  log('🎯', `Run ID: ${C.bold}${result.runId}${C.reset}`);
  log('📦', `Tasks: ${result.tasksCreated} created → ${result.tasksCreated} completed`);
  log('📊', `Actions: ${loggedActions.length} logged`);
  log('🔔', `Notifications: ready to dispatch`);

  console.log(`\n${C.bold}${C.green}  ✅ Full loop complete!${C.reset}\n`);
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
