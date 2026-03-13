// TypeScript types matching CommandMate DB schema
// Synced with supabase/migrations as of 2026-03-17

// ============================================================
// Core entities
// ============================================================

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  timezone: string;
  telegram_chat_id: string | null;
  preferred_channel: "dashboard" | "telegram" | "zalo" | "email";
  notification_settings: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "starter" | "pro" | "team";
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

export type WorkspaceApiKey = {
  id: string;
  workspace_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
};

// ============================================================
// Agents
// ============================================================

export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  type: "openclaw" | "crewai" | "custom" | "founder" | "ai";
  description: string | null;
  avatar_url: string | null;
  status: "online" | "offline" | "error" | "paused";
  config: Record<string, unknown>;
  external_id: string | null;
  last_seen_at: string | null;
  capacity: number;
  agent_token_hash: string | null;
  status_message: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields — populated from config JSONB or UI layer, not DB columns
  role: string | null;
  about: string | null;
  skills: string[] | null;
  avatar_emoji: string | null;
};

export type AgentSkill = {
  id: string;
  agent_id: string;
  skill: string;
  proficiency: number;
};

export type AgentHeartbeat = {
  id: string;
  agent_id: string;
  status: string;
  load: number;
  current_task_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentProfile = {
  id: string;
  workspace_id: string;
  agent_id: string;
  name: string;
  avatar_url: string | null;
  persona: string;
  style_guide: Record<string, unknown>;
  expertise_areas: string[];
  memory_context: string[];
  performance_stats: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AgentExample = {
  id: string;
  agent_profile_id: string;
  task_id: string;
  example_type: "positive" | "negative";
  task_description: string | null;
  output_snippet: string | null;
  rating: number | null;
  feedback: string | null;
  created_at: string;
};

// ============================================================
// Tasks
// ============================================================

export type TaskQueueItem = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: "urgent" | "normal" | "background";
  status:
    | "queued"
    | "assigned"
    | "in-progress"
    | "pending-approval"
    | "completed"
    | "failed"
    | "failed_permanent"
    | "cancelled";
  required_skills: string[];
  needs_approval: boolean;
  assigned_agent_id: string | null;
  claimed_at: string | null;
  progress_percent: number;
  status_message: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  approval_status: "pending" | "approved" | "rejected" | null;
  approval_feedback: string | null;
  approval_rating: number | null;
  approved_by: string | null;
  approved_at: string | null;
  feedback_text: string | null;
  learned_at: string | null;
  parent_task_id: string | null;
  batch_id: string | null;
  batch_index: number | null;
  retry_count: number;
  reassignment_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** Legacy tasks table — use TaskQueueItem for active work */
export type Task = {
  id: string;
  agent_id: string;
  workspace_id: string;
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  cost_estimate: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TaskHistory = {
  id: string;
  task_id: string;
  event_type: string;
  actor: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  agent_id: string;
  workspace_id: string;
  content: string;
  created_at: string;
};

export type TaskEvaluation = {
  id: string;
  task_id: string;
  workspace_id: string;
  evaluator: string;
  score: number;
  reasoning: string;
  criteria: Record<string, unknown>;
  created_at: string;
};

// ============================================================
// Messages & Notifications
// ============================================================

export type Message = {
  id: string;
  agent_id: string;
  workspace_id: string;
  direction: "inbound" | "outbound";
  content: string;
  metadata: Record<string, unknown> | null;
  is_broadcast: boolean;
  created_at: string;
};

export type NotificationLog = {
  id: string;
  user_id: string;
  task_id: string | null;
  channel: string;
  status: "pending" | "sent" | "failed";
  message: string | null;
  error: string | null;
  external_id: string | null;
  created_at: string;
  sent_at: string | null;
};

// ============================================================
// Workspace Documents (Knowledge Base)
// ============================================================

export type WorkspaceDocument = {
  id: string;
  workspace_id: string;
  title: string;
  type: "brand_guideline" | "product_catalog" | "style_guide" | "other";
  content: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  tags: string[];
  uploaded_by: string | null;
  embeddings: number[] | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Webhooks
// ============================================================

export type Webhook = {
  id: string;
  workspace_id: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookLog = {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown> | null;
  status_code: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
};

// ============================================================
// MCP
// ============================================================

export type McpServer = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  transport: "stdio" | "sse";
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  enabled: boolean;
  timeout: number;
  created_at: string;
  updated_at: string;
};

export type McpToolUsage = {
  id: string;
  server_id: string | null;
  tool_name: string;
  duration_ms: number;
  status: "success" | "error";
  error_message: string | null;
  created_at: string;
};
