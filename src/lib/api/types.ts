// === Agent Types ===

export interface RegisterAgentRequest {
  name: string;
  external_id: string;
  type: "openclaw" | "crewai" | "custom";
  role?: string;
  skills?: string[];
  capacity?: number;
  metadata?: Record<string, unknown>;
}

export interface RegisterAgentResponse {
  agent_id: string;
  api_token: string;
  workspace_id: string;
  status: string;
}

export interface HeartbeatRequest {
  status: "idle" | "busy" | "error";
  current_task_id?: string | null;
  load?: number;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatResponse {
  ack: boolean;
  pending_tasks: number;
  server_time: string;
}

export interface UpdateStatusRequest {
  status: string;
  status_message?: string;
}

export interface UpdateStatusResponse {
  agent_id: string;
  status: string;
  updated_at: string;
}

// === Task Types ===

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type?: string;
  priority?: "urgent" | "normal" | "background";
  required_skills?: string[];
  needs_approval?: boolean;
  parent_task_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ClaimTaskRequest {
  agent_id: string;
  estimated_duration_minutes?: number;
}

export interface ProgressRequest {
  agent_id: string;
  progress_percent: number;
  status_message?: string;
}

export interface CompleteTaskRequest {
  agent_id: string;
  output: Record<string, unknown>;
  duration_ms?: number;
  notes?: string;
}

export interface FailTaskRequest {
  agent_id: string;
  error: string;
  retry_suggested?: boolean;
}

// === Approval Types ===

export interface ApproveRequest {
  approved_by: string;
  rating?: number;
  comment?: string;
}

export interface RejectRequest {
  rejected_by: string;
  feedback: string;
  action: "revise" | "reassign" | "cancel";
}
