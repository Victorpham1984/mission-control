-- CommandMate + BizMate — Complete Database Schema
-- Synced with all migrations as of 2026-03-14
-- Source of truth: supabase/migrations/*.sql
-- This file is DOCUMENTATION — do NOT run directly. Use migrations.

-- ============================================================
-- EXTENSIONS
-- ============================================================
-- pgcrypto (API key hashing)
-- pgvector (semantic search embeddings)
-- pg_cron (scheduled jobs)

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  telegram_chat_id TEXT,
  preferred_channel TEXT DEFAULT 'dashboard' CHECK (preferred_channel IN ('dashboard', 'telegram', 'zalo', 'email')),
  notification_settings JSONB DEFAULT '{"task_completed": true, "task_approval_needed": true, "task_failed": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: user owns own profile
-- Trigger: on_auth_user_created → handle_new_user() creates profile + workspace

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'team')),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: owner can CRUD own workspaces
-- Trigger: on_workspace_created_api_key → auto-creates API key
-- Trigger: on_workspace_created_founder → auto-creates founder agent

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- WORKSPACE API KEYS
-- ============================================================
CREATE TABLE public.workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT DEFAULT 'Default',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Indexes: workspace_id, key_hash
-- RLS: workspace owner

-- ============================================================
-- AGENTS
-- ============================================================
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('openclaw', 'crewai', 'custom', 'founder', 'ai')),
  description TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'paused')),
  config JSONB NOT NULL DEFAULT '{}',
  external_id TEXT,
  last_seen_at TIMESTAMPTZ,
  capacity INTEGER DEFAULT 3,
  agent_token_hash TEXT,
  status_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: workspace owner CRUD
-- Realtime enabled

-- ============================================================
-- AGENT SKILLS
-- ============================================================
CREATE TABLE public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  proficiency REAL DEFAULT 1.0,
  UNIQUE(agent_id, skill)
);

-- Indexes: agent_id, skill
-- RLS: workspace owner (via agents → workspaces join)

-- ============================================================
-- AGENT HEARTBEATS
-- ============================================================
CREATE TABLE public.agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  load REAL DEFAULT 0,
  current_task_id UUID REFERENCES public.task_queue(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index: (agent_id, created_at DESC)
-- Realtime enabled
-- RLS: workspace owner (via agents → workspaces join)

-- ============================================================
-- AGENT PROFILES (persona & memory)
-- ============================================================
CREATE TABLE public.agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  persona TEXT NOT NULL,
  style_guide JSONB DEFAULT '{}',
  expertise_areas TEXT[] DEFAULT '{}',
  memory_context TEXT[] DEFAULT '{}',
  performance_stats JSONB DEFAULT '{"total_tasks": 0, "avg_rating": 0, "trend": []}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);

-- RLS: workspace owner + service_role bypass

-- ============================================================
-- TASK QUEUE (primary task table — 40+ code references)
-- ============================================================
CREATE TABLE public.task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'background')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'in-progress', 'pending-approval', 'completed', 'failed', 'failed_permanent', 'cancelled')),
  required_skills TEXT[] DEFAULT '{}',
  needs_approval BOOLEAN DEFAULT true,

  assigned_agent_id UUID REFERENCES public.agents(id),
  claimed_at TIMESTAMPTZ,

  progress_percent INTEGER DEFAULT 0,
  status_message TEXT,

  output JSONB,
  error TEXT,
  duration_ms INTEGER,

  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_feedback TEXT,
  approval_rating INTEGER CHECK (approval_rating BETWEEN 1 AND 5),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,

  feedback_text TEXT,
  learned_at TIMESTAMPTZ,

  parent_task_id UUID REFERENCES public.task_queue(id),
  batch_id UUID,
  batch_index INTEGER,

  retry_count INTEGER DEFAULT 0,
  reassignment_count INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes: workspace_id, status, (priority, created_at), assigned_agent_id, batch_id
-- Trigger: updated_at auto-update
-- Realtime enabled
-- RLS: workspace owner

-- ============================================================
-- TASK HISTORY
-- ============================================================
CREATE TABLE public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index: (task_id, created_at DESC)
-- RLS: workspace owner (via task_queue → workspaces join)

-- ============================================================
-- TASK COMMENTS
-- ============================================================
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes: (task_id, created_at), workspace_id
-- RLS: workspace owner + service_role bypass
-- Realtime enabled

-- ============================================================
-- TASK EVALUATIONS
-- ============================================================
CREATE TABLE public.task_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  evaluator TEXT NOT NULL DEFAULT 'claude-opus-4',
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  reasoning TEXT NOT NULL,
  criteria JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id)
);

-- RLS: service_role only

-- ============================================================
-- AGENT EXAMPLES (learning from task feedback)
-- ============================================================
CREATE TABLE public.agent_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
  task_description TEXT,
  output_snippet TEXT,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: service_role only

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  metadata JSONB,
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Realtime enabled
-- RLS: workspace owner

-- ============================================================
-- TASKS (legacy — replaced by task_queue for active use)
-- ============================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  cost_estimate DECIMAL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKSPACE DOCUMENTS (knowledge base)
-- ============================================================
CREATE TABLE public.workspace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('brand_guideline', 'product_catalog', 'style_guide', 'other')),
  content TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID REFERENCES public.profiles(id),
  embeddings VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index: HNSW on embeddings for vector similarity search
-- Function: match_documents(query_embedding, threshold, count, workspace_id, doc_type)
-- RLS: workspace owner + service_role bypass

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  task_id UUID REFERENCES public.task_queue(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message TEXT,
  error TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indexes: (user_id, created_at DESC), task_id

-- ============================================================
-- WEBHOOKS
-- ============================================================
CREATE TABLE public.webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WEBHOOK LOGS
-- ============================================================
CREATE TABLE public.webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  status_code INT,
  success BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MCP SERVERS (see also src/lib/mcp/schema.sql)
-- ============================================================
CREATE TABLE public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  transport TEXT NOT NULL DEFAULT 'stdio' CHECK (transport IN ('stdio', 'sse')),
  command TEXT,
  args JSONB DEFAULT '[]'::jsonb,
  env JSONB DEFAULT '{}'::jsonb,
  url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  timeout INTEGER NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- ============================================================
-- MCP TOOL USAGE
-- ============================================================
CREATE TABLE public.mcp_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.mcp_servers(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materialized view: mcp_tool_stats (aggregated metrics per server/tool)

-- ============================================================
-- BIZMATE PHASE 1: COMPANIES (1:1 per workspace, soft delete)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  team_size TEXT,
  icp_segment TEXT DEFAULT 'sme' CHECK (icp_segment IN ('creator', 'sme', 'agency')),
  currency TEXT DEFAULT 'VND',
  settings JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);
-- RLS: workspace_owner_companies, service_role_companies
-- Index: idx_companies_workspace (workspace_id)

-- ============================================================
-- BIZMATE PHASE 1: GOALS (business objectives)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_value DECIMAL NOT NULL,
  current_value DECIMAL DEFAULT 0,
  unit TEXT NOT NULL,
  deadline DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: workspace_owner_goals (via companies, soft-delete aware), service_role_goals
-- Indexes: idx_goals_company, idx_goals_status

-- ============================================================
-- BIZMATE PHASE 1: KPIS (key performance indicators)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('acquisition', 'activation', 'revenue', 'operations')),
  current_value DECIMAL DEFAULT 0,
  target_value DECIMAL,
  unit TEXT NOT NULL,
  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: workspace_owner_kpis (via companies, soft-delete aware), service_role_kpis
-- Indexes: idx_kpis_company, idx_kpis_company_category, idx_kpis_goal (partial)

-- ============================================================
-- KEY FUNCTIONS
-- ============================================================
-- handle_new_user()          — signup → creates profile + workspace
-- handle_new_workspace_founder() — workspace creation → creates founder agent
-- handle_new_workspace_api_key() — workspace creation → creates API key
-- mark_offline_agents()      — cron: marks agents offline if no heartbeat in 5min
-- match_documents()          — pgvector: semantic similarity search
-- refresh_mcp_tool_stats()   — refresh materialized view
-- bizmate_set_updated_at()   — auto-update updated_at on companies/goals/kpis
