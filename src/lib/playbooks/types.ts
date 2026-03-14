/**
 * Playbook execution types
 */

/** A single step in a playbook config.steps[] */
export interface PlaybookStep {
  order: number;
  action: string;
  agent_skill: string;
  trigger: string;
  requires_approval: boolean;
  config: Record<string, unknown>;
}

/** Context for a single playbook run */
export interface PlaybookRunContext {
  runId: string;
  installedPlaybookId: string;
  playbookId: string;
  playbookName: string;
  companyId: string;
  workspaceId: string;
  customization: Record<string, unknown>;
}

/** Result of a playbook run */
export interface PlaybookRunResult {
  runId: string;
  installedPlaybookId: string;
  playbookName: string;
  tasksCreated: number;
  steps: Array<{
    order: number;
    action: string;
    taskId: string;
  }>;
}

/** Metadata attached to each task created by the executor */
export interface PlaybookTaskMetadata {
  playbook_run_id: string;
  installed_playbook_id: string;
  playbook_id: string;
  playbook_name: string;
  step_order: number;
  step_action: string;
  step_config: Record<string, unknown>;
}
