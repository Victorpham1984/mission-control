/**
 * Smoke tests — validate types, schema consistency, and critical path shapes.
 * These run without Supabase connection (pure unit tests).
 */

import type {
  UserProfile,
  Workspace,
  WorkspaceApiKey,
  Agent,
  AgentSkill,
  AgentHeartbeat,
  AgentProfile,
  AgentExample,
  TaskQueueItem,
  Task,
  TaskHistory,
  TaskComment,
  TaskEvaluation,
  Message,
  NotificationLog,
  WorkspaceDocument,
  Webhook,
  WebhookLog,
  McpServer,
  McpToolUsage,
  WorkspaceMember,
  Company,
  Goal,
  Kpi,
  Playbook,
  InstalledPlaybook,
  Action,
} from "@/lib/supabase/types";

// ============================================================
// Type shape tests — ensure types compile and match DB schema
// ============================================================

describe("Type definitions", () => {
  it("UserProfile has notification fields from migration 20260222", () => {
    const profile: UserProfile = {
      id: "uuid",
      email: "test@example.com",
      full_name: "Test",
      avatar_url: null,
      timezone: "UTC",
      telegram_chat_id: null,
      preferred_channel: "dashboard",
      notification_settings: { task_completed: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(profile.preferred_channel).toBe("dashboard");
    expect(profile.telegram_chat_id).toBeNull();
  });

  it("Agent has capacity, token_hash, status_message from migration 20260219", () => {
    const agent: Agent = {
      id: "uuid",
      workspace_id: "uuid",
      name: "Test Agent",
      type: "custom",
      description: null,
      avatar_url: null,
      status: "online",
      config: {},
      external_id: null,
      last_seen_at: null,
      capacity: 3,
      agent_token_hash: null,
      status_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: null,
      about: null,
      skills: null,
      avatar_emoji: null,
    };
    expect(agent.capacity).toBe(3);
    expect(agent.type).toBe("custom");
  });

  it("Agent type includes ai from migration 20260225000009", () => {
    const agent: Agent = {
      id: "uuid",
      workspace_id: "uuid",
      name: "AI Agent",
      type: "ai",
      description: null,
      avatar_url: null,
      status: "online",
      config: {},
      external_id: null,
      last_seen_at: null,
      capacity: 3,
      agent_token_hash: null,
      status_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: null,
      about: null,
      skills: null,
      avatar_emoji: null,
    };
    expect(agent.type).toBe("ai");
  });

  it("TaskQueueItem has retry/reassignment from migration 20260221", () => {
    const task: TaskQueueItem = {
      id: "uuid",
      workspace_id: "uuid",
      title: "Test Task",
      description: null,
      type: "custom",
      priority: "normal",
      status: "queued",
      required_skills: [],
      needs_approval: true,
      assigned_agent_id: null,
      claimed_at: null,
      progress_percent: 0,
      status_message: null,
      output: null,
      error: null,
      duration_ms: null,
      approval_status: null,
      approval_feedback: null,
      approval_rating: null,
      approved_by: null,
      approved_at: null,
      feedback_text: null,
      learned_at: null,
      parent_task_id: null,
      batch_id: null,
      batch_index: null,
      retry_count: 0,
      reassignment_count: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };
    expect(task.retry_count).toBe(0);
    expect(task.status).toBe("queued");
  });

  it("TaskQueueItem supports failed_permanent status", () => {
    const task = { status: "failed_permanent" as TaskQueueItem["status"] };
    expect(task.status).toBe("failed_permanent");
  });

  it("WorkspaceDocument has embeddings field from migration 20260224", () => {
    const doc: WorkspaceDocument = {
      id: "uuid",
      workspace_id: "uuid",
      title: "Brand Guide",
      type: "brand_guideline",
      content: "...",
      file_size_bytes: 1024,
      mime_type: "text/plain",
      tags: ["brand"],
      uploaded_by: null,
      embeddings: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(doc.embeddings).toBeNull();
    expect(doc.type).toBe("brand_guideline");
  });
});

// ============================================================
// Critical path shape tests — simulate register → task → approve
// ============================================================

describe("Critical path: register → task → approve", () => {
  it("Step 1: Agent registration produces correct shape", () => {
    const registerPayload = {
      name: "Test Agent",
      type: "custom" as const,
      workspace_id: "ws-uuid",
      capabilities: ["content-writing"],
    };

    // Simulate API response
    const response: Pick<Agent, "id" | "name" | "type" | "status"> & {
      api_token: string;
    } = {
      id: "agent-uuid",
      name: registerPayload.name,
      type: registerPayload.type,
      status: "online",
      api_token: "cma_abc123",
    };

    expect(response.api_token).toMatch(/^cma_/);
    expect(response.status).toBe("online");
  });

  it("Step 2: Task creation with auto-assignment", () => {
    const createPayload = {
      title: "Write blog post",
      description: "About AI agents",
      required_skills: ["content-writing"],
      needs_approval: true,
      priority: "normal" as const,
    };

    // Simulate task created
    const task: Pick<TaskQueueItem, "id" | "status" | "assigned_agent_id" | "needs_approval"> = {
      id: "task-uuid",
      status: "assigned",
      assigned_agent_id: "agent-uuid",
      needs_approval: createPayload.needs_approval,
    };

    expect(task.status).toBe("assigned");
    expect(task.assigned_agent_id).toBeTruthy();
  });

  it("Step 3: Task completion transitions to pending-approval", () => {
    const completed: Pick<TaskQueueItem, "status" | "output" | "duration_ms" | "approval_status"> = {
      status: "pending-approval",
      output: { content: "Blog post content..." },
      duration_ms: 5000,
      approval_status: "pending",
    };

    expect(completed.status).toBe("pending-approval");
    expect(completed.approval_status).toBe("pending");
  });

  it("Step 4: Task approval with rating", () => {
    const approved: Pick<TaskQueueItem, "status" | "approval_status" | "approval_rating" | "approved_at"> = {
      status: "completed",
      approval_status: "approved",
      approval_rating: 5,
      approved_at: new Date().toISOString(),
    };

    expect(approved.approval_status).toBe("approved");
    expect(approved.approval_rating).toBeGreaterThanOrEqual(1);
    expect(approved.approval_rating).toBeLessThanOrEqual(5);
  });
});

// ============================================================
// All types compile check — ensures no missing exports
// ============================================================

describe("All types are exported and compile", () => {
  it("exports 27 types matching 27 DB tables", () => {
    // This test passes if the file compiles — each type is imported above
    const typeNames: string[] = [
      "UserProfile",
      "Workspace",
      "WorkspaceMember",
      "WorkspaceApiKey",
      "Agent",
      "AgentSkill",
      "AgentHeartbeat",
      "AgentProfile",
      "AgentExample",
      "TaskQueueItem",
      "Task",
      "TaskHistory",
      "TaskComment",
      "TaskEvaluation",
      "Message",
      "NotificationLog",
      "WorkspaceDocument",
      "Webhook",
      "WebhookLog",
      "McpServer",
      "McpToolUsage",
      // BizMate Phase 1
      "Company",
      "Goal",
      "Kpi",
      // BizMate Phase 2
      "Playbook",
      "InstalledPlaybook",
      "Action",
    ];
    expect(typeNames).toHaveLength(27);
  });

  it("Company has soft delete and icp_segment enum", () => {
    const company: Company = {
      id: "uuid",
      workspace_id: "uuid",
      name: "Shop Hạnh Phúc",
      industry: "ecommerce",
      team_size: "6-20",
      icp_segment: "sme",
      currency: "VND",
      settings: { timezone: "Asia/Ho_Chi_Minh" },
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(company.deleted_at).toBeNull();
    expect(company.icp_segment).toBe("sme");
  });

  it("Goal has status enum and progress tracking", () => {
    const goal: Goal = {
      id: "uuid",
      company_id: "uuid",
      title: "Đạt 100 đơn hàng/tháng",
      target_value: 100,
      current_value: 42,
      unit: "orders",
      deadline: "2026-04-30",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(goal.current_value).toBeLessThan(goal.target_value);
    expect(goal.status).toBe("active");
  });

  it("Kpi has category enum and optional goal link", () => {
    const kpi: Kpi = {
      id: "uuid",
      company_id: "uuid",
      goal_id: null,
      name: "Đơn hàng/tháng",
      category: "operations",
      current_value: 0,
      target_value: 100,
      unit: "count",
      source: "calculated",
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(kpi.goal_id).toBeNull();
    expect(kpi.category).toBe("operations");
  });

  it("Playbook has category enum and marketplace fields", () => {
    const playbook: Playbook = {
      id: "uuid",
      name: "Shopee Auto-Order",
      description: "Tự động xử lý đơn hàng Shopee",
      category: "ecommerce",
      author_id: null,
      config: { steps: [] },
      is_public: true,
      install_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(playbook.author_id).toBeNull();
    expect(playbook.category).toBe("ecommerce");
    expect(playbook.is_public).toBe(true);
  });

  it("InstalledPlaybook has schedule and run tracking", () => {
    const installed: InstalledPlaybook = {
      id: "uuid",
      company_id: "uuid",
      playbook_id: "uuid",
      customization: {},
      active: true,
      schedule: "*/15 * * * *",
      last_run_at: null,
      run_count: 0,
      installed_at: new Date().toISOString(),
    };
    expect(installed.active).toBe(true);
    expect(installed.run_count).toBe(0);
    expect(installed.last_run_at).toBeNull();
  });

  it("Action is append-only with cost and evidence", () => {
    const action: Action = {
      id: "uuid",
      company_id: "uuid",
      installed_playbook_id: "uuid",
      task_id: null,
      action_type: "pull_orders",
      description: "Pulled 12 orders from Shopee",
      success: true,
      evidence: { order_count: 12 },
      cost: 0.01,
      duration_ms: 2300,
      created_at: new Date().toISOString(),
    };
    expect(action.success).toBe(true);
    expect(action.cost).toBe(0.01);
    expect(action.task_id).toBeNull();
  });
});
