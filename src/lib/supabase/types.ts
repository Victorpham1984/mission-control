// TypeScript types matching CommandMate DB schema

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  timezone: string;
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

export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  type: "openclaw" | "crewai" | "custom";
  description: string | null;
  avatar_url: string | null;
  status: "online" | "offline" | "error" | "paused";
  config: Record<string, unknown>;
  external_id: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  role: string | null;
  about: string | null;
  skills: string[] | null;
  avatar_emoji: string | null;
};

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

export type TaskComment = {
  id: string;
  task_id: string;
  agent_id: string;
  workspace_id: string;
  content: string;
  created_at: string;
};

export type Subscription = {
  id: string;
  workspace_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: "starter" | "pro" | "team";
  status: "active" | "canceled" | "past_due" | "trialing";
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
};
