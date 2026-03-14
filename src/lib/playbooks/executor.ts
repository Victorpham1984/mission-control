/**
 * PlaybookExecutor — Reads installed playbook config and spawns task_queue entries
 *
 * Concurrency safety (two-phase):
 *   Phase 1 (pre-check):  JSONB contains query on task_queue — fast rejection
 *   Phase 2 (post-verify): After creating tasks, verify no OTHER run_id exists
 *     in-flight. If found, cancel our tasks and return 409.
 *
 * This narrows the race window to the time between the pre-check and the first
 * INSERT. For true single-writer guarantee, use a dedicated playbook_runs table
 * with a UNIQUE(installed_playbook_id) WHERE status='running' constraint.
 *
 * TODO(scale): At >100K tasks, the JSONB @> containment query (even with GIN index)
 * becomes expensive. Migrate to a playbook_runs tracking table at that point.
 * Threshold: monitor query time on idx_task_queue_metadata_gin; act if p95 > 50ms.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  PlaybookStep,
  PlaybookRunContext,
  PlaybookRunResult,
  PlaybookTaskMetadata,
} from './types';

export class PlaybookExecutor {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Execute a playbook run: validate → create tasks → verify no race → update state.
   */
  async run(
    installedPlaybookId: string,
    workspaceId: string,
  ): Promise<PlaybookRunResult> {
    // 1. Fetch installed playbook
    const { data: installed, error: ipError } = await this.supabase
      .from('installed_playbooks')
      .select('id, company_id, playbook_id, customization, active, run_count')
      .eq('id', installedPlaybookId)
      .single();

    if (ipError || !installed) {
      throw new PlaybookExecutorError('not_found', `Installed playbook ${installedPlaybookId} not found`);
    }

    if (!installed.active) {
      throw new PlaybookExecutorError('inactive', 'Playbook is inactive — activate before running');
    }

    // 2. Verify company belongs to workspace
    const { data: company } = await this.supabase
      .from('companies')
      .select('id, workspace_id')
      .eq('id', installed.company_id)
      .single();

    if (!company || company.workspace_id !== workspaceId) {
      throw new PlaybookExecutorError('not_found', 'Company not found in this workspace');
    }

    // 3. Phase 1: Pre-check — fast rejection if tasks already in-flight
    const { count: inFlightCount } = await this.supabase
      .from('task_queue')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('status', ['queued', 'in-progress'])
      .contains('metadata', { installed_playbook_id: installedPlaybookId });

    if (inFlightCount && inFlightCount > 0) {
      throw new PlaybookExecutorError(
        'run_in_progress',
        `Playbook has ${inFlightCount} in-flight task(s) — wait for completion before re-running`,
      );
    }

    // 4. Fetch playbook template
    const { data: playbook, error: pbError } = await this.supabase
      .from('playbooks')
      .select('id, name, config')
      .eq('id', installed.playbook_id)
      .single();

    if (pbError || !playbook) {
      throw new PlaybookExecutorError('not_found', `Playbook template ${installed.playbook_id} not found`);
    }

    // 5. Parse steps from config
    const config = playbook.config as Record<string, unknown>;
    const steps = this.parseSteps(config);

    if (steps.length === 0) {
      throw new PlaybookExecutorError('no_steps', 'Playbook has no steps configured');
    }

    // 6. Generate run ID
    const runId = crypto.randomUUID();

    // 7. Create tasks — one per step
    const ctx: PlaybookRunContext = {
      runId,
      installedPlaybookId: installed.id,
      playbookId: playbook.id,
      playbookName: playbook.name,
      companyId: installed.company_id,
      workspaceId,
      customization: (installed.customization as Record<string, unknown>) ?? {},
    };

    const createdTasks: Array<{ order: number; action: string; taskId: string }> = [];

    for (const step of steps) {
      const taskId = await this.createTaskForStep(ctx, step);
      createdTasks.push({ order: step.order, action: step.action, taskId });
    }

    // 8. Phase 2: Post-verify — check for conflicting runs created during our window
    const conflict = await this.checkPostCreationConflict(
      workspaceId,
      installedPlaybookId,
      runId,
    );

    if (conflict) {
      // Lost the race — cancel our tasks
      await this.cancelTasks(createdTasks.map(t => t.taskId));
      throw new PlaybookExecutorError(
        'run_in_progress',
        'Concurrent run detected — this run was cancelled to prevent duplicates',
      );
    }

    // 9. Update installed_playbook run state
    const now = new Date().toISOString();
    await this.supabase
      .from('installed_playbooks')
      .update({
        last_run_at: now,
        run_count: (installed.run_count as number ?? 0) + 1,
      })
      .eq('id', installedPlaybookId);

    return {
      runId,
      installedPlaybookId,
      playbookName: playbook.name,
      tasksCreated: createdTasks.length,
      steps: createdTasks,
    };
  }

  /**
   * After creating tasks, check if another run_id is also in-flight
   * for the same installed_playbook_id. This catches the race where two
   * requests both passed the pre-check.
   *
   * Returns true if a conflicting run exists (we should cancel ours).
   */
  private async checkPostCreationConflict(
    workspaceId: string,
    installedPlaybookId: string,
    ourRunId: string,
  ): Promise<boolean> {
    // Find in-flight tasks for this playbook with a DIFFERENT run_id
    const { data: conflicting } = await this.supabase
      .from('task_queue')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .in('status', ['queued', 'in-progress'])
      .contains('metadata', { installed_playbook_id: installedPlaybookId })
      .limit(50);

    if (!conflicting) return false;

    // Check if any task belongs to a different run
    const otherRunIds = new Set<string>();
    for (const task of conflicting) {
      const meta = task.metadata as Record<string, unknown> | null;
      const taskRunId = meta?.playbook_run_id as string | undefined;
      if (taskRunId && taskRunId !== ourRunId) {
        otherRunIds.add(taskRunId);
      }
    }

    return otherRunIds.size > 0;
  }

  /**
   * Cancel tasks created by a losing race.
   */
  private async cancelTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await this.supabase
      .from('task_queue')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', taskIds);
  }

  /**
   * Parse steps from playbook config JSONB.
   * Sorts by order to ensure deterministic task creation.
   */
  private parseSteps(config: Record<string, unknown>): PlaybookStep[] {
    const raw = config.steps;
    if (!Array.isArray(raw)) return [];

    return (raw as PlaybookStep[])
      .filter((s) => s.action && typeof s.order === 'number')
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Create a single task_queue entry for a playbook step.
   */
  private async createTaskForStep(
    ctx: PlaybookRunContext,
    step: PlaybookStep,
  ): Promise<string> {
    const metadata: PlaybookTaskMetadata = {
      playbook_run_id: ctx.runId,
      installed_playbook_id: ctx.installedPlaybookId,
      playbook_id: ctx.playbookId,
      playbook_name: ctx.playbookName,
      step_order: step.order,
      step_action: step.action,
      step_config: step.config ?? {},
    };

    const { data: task, error } = await this.supabase
      .from('task_queue')
      .insert({
        workspace_id: ctx.workspaceId,
        title: `[${ctx.playbookName}] Step ${step.order}: ${step.action}`,
        description: `Playbook step: ${step.action} (run: ${ctx.runId})`,
        type: step.action,
        priority: 'normal',
        required_skills: [step.agent_skill],
        needs_approval: step.requires_approval,
        metadata,
      })
      .select('id')
      .single();

    if (error || !task) {
      throw new PlaybookExecutorError(
        'task_creation_failed',
        `Failed to create task for step ${step.order} (${step.action}): ${error?.message ?? 'unknown'}`,
      );
    }

    return task.id;
  }
}

/**
 * Structured error for playbook execution failures.
 */
export class PlaybookExecutorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlaybookExecutorError';
  }
}

/**
 * Map PlaybookExecutorError codes to HTTP status codes.
 */
export function playbookErrorStatus(code: string): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'inactive':
    case 'no_steps':
      return 400;
    case 'run_in_progress':
      return 409;
    case 'task_creation_failed':
      return 500;
    default:
      return 500;
  }
}
