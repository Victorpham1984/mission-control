export type WebhookEventType =
  | "task.created"
  | "task.assigned"
  | "task.completed"
  | "task.pending_approval"
  | "task.failed";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  workspace_id: string;
  data: {
    task_id: string;
    title: string;
    description: string | null;
    priority: string;
    required_skills: string[];
    status: string;
    assigned_agent_id: string | null;
    [key: string]: unknown;
  };
}

export interface WebhookRecord {
  id: string;
  workspace_id: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}
