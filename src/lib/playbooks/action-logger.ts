/**
 * ActionLogger — Bridges task completion to the BizMate actions table
 *
 * Called when a task with playbook metadata completes (success or failure).
 * Logs both success and failure paths for billing and observability.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { PlaybookTaskMetadata } from './types';

export interface ActionLogInput {
  companyId: string;
  installedPlaybookId: string;
  taskId: string;
  actionType: string;
  description: string | null;
  success: boolean;
  evidence: Record<string, unknown>;
  cost: number;
  durationMs: number | null;
}

export class ActionLogger {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Log an action from a completed task.
   * Called from the task complete/fail routes when task metadata contains playbook context.
   */
  async logFromTask(
    taskId: string,
    workspaceId: string,
    output: Record<string, unknown>,
    success: boolean,
    durationMs: number | null,
    error?: string,
  ): Promise<void> {
    // 1. Fetch task metadata
    const { data: task } = await this.supabase
      .from('task_queue')
      .select('id, type, title, metadata')
      .eq('id', taskId)
      .single();

    if (!task) return;

    const metadata = task.metadata as Record<string, unknown> | null;
    if (!metadata?.installed_playbook_id) return; // Not a playbook task — skip

    // 2. Fetch company_id from installed_playbook
    const { data: installed } = await this.supabase
      .from('installed_playbooks')
      .select('company_id')
      .eq('id', metadata.installed_playbook_id as string)
      .single();

    if (!installed) return;

    // 3. Build evidence
    const evidence: Record<string, unknown> = {
      ...output,
      workspace_id: workspaceId,
      playbook_run_id: metadata.playbook_run_id,
      step_order: metadata.step_order,
    };

    if (error) {
      evidence.error = error;
    }

    // 4. Insert action
    await this.supabase.from('actions').insert({
      company_id: installed.company_id,
      installed_playbook_id: metadata.installed_playbook_id as string,
      task_id: taskId,
      action_type: (metadata.step_action as string) ?? task.type ?? 'unknown',
      description: success
        ? `Step ${metadata.step_order}: ${metadata.step_action} completed`
        : `Step ${metadata.step_order}: ${metadata.step_action} failed — ${error ?? 'unknown error'}`,
      success,
      evidence,
      cost: 0,
      duration_ms: durationMs,
    });
  }

  /**
   * Check if a task has playbook metadata (useful for callers to decide whether to log).
   */
  static hasPlaybookMetadata(metadata: unknown): metadata is PlaybookTaskMetadata {
    if (!metadata || typeof metadata !== 'object') return false;
    const m = metadata as Record<string, unknown>;
    return typeof m.installed_playbook_id === 'string' && typeof m.playbook_run_id === 'string';
  }
}
