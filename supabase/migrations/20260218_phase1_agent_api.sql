-- Phase 1: Agent API — DB Migration
-- Created: 2026-02-18 by Thép ⚙️

-- ============================================================
-- 1. workspace_api_keys
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT DEFAULT 'Default',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_api_keys_workspace ON public.workspace_api_keys(workspace_id);
CREATE INDEX idx_api_keys_hash ON public.workspace_api_keys(key_hash);

ALTER TABLE public.workspace_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_api_keys" ON public.workspace_api_keys
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- ============================================================
-- 2. agent_skills
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  proficiency REAL DEFAULT 1.0,
  UNIQUE(agent_id, skill)
);

CREATE INDEX idx_agent_skills_agent ON public.agent_skills(agent_id);
CREATE INDEX idx_agent_skills_skill ON public.agent_skills(skill);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_agent_skills" ON public.agent_skills
  FOR ALL USING (
    agent_id IN (
      SELECT a.id FROM public.agents a
      JOIN public.workspaces w ON a.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. task_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'background')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'in-progress', 'pending-approval', 'completed', 'failed', 'cancelled')),
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

  parent_task_id UUID REFERENCES public.task_queue(id),
  batch_id UUID,
  batch_index INTEGER,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_task_queue_workspace ON public.task_queue(workspace_id);
CREATE INDEX idx_task_queue_status ON public.task_queue(status);
CREATE INDEX idx_task_queue_priority ON public.task_queue(priority, created_at);
CREATE INDEX idx_task_queue_assigned ON public.task_queue(assigned_agent_id);
CREATE INDEX idx_task_queue_batch ON public.task_queue(batch_id);

ALTER TABLE public.task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_task_queue" ON public.task_queue
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_task_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_queue_updated_at
  BEFORE UPDATE ON public.task_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_task_queue_updated_at();

-- ============================================================
-- 4. agent_heartbeats
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  load REAL DEFAULT 0,
  current_task_id UUID REFERENCES public.task_queue(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_heartbeats_agent_time ON public.agent_heartbeats(agent_id, created_at DESC);

ALTER TABLE public.agent_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_heartbeats" ON public.agent_heartbeats
  FOR ALL USING (
    agent_id IN (
      SELECT a.id FROM public.agents a
      JOIN public.workspaces w ON a.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 5. ALTER agents table
-- ============================================================
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 3;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS agent_token_hash TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS status_message TEXT;

-- ============================================================
-- 6. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_heartbeats;

-- ============================================================
-- 7. Auto-create API key on workspace creation
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_new_workspace_api_key()
RETURNS TRIGGER AS $$
DECLARE
  raw_key TEXT;
  hashed TEXT;
BEGIN
  raw_key := 'cm_' || replace(gen_random_uuid()::text, '-', '');
  hashed := encode(digest(raw_key, 'sha256'), 'hex');

  INSERT INTO public.workspace_api_keys (workspace_id, key_hash, key_prefix, name)
  VALUES (NEW.id, hashed, left(raw_key, 11), 'Default');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created_api_key ON public.workspaces;
CREATE TRIGGER on_workspace_created_api_key
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_api_key();

-- ============================================================
-- 8. Offline detection function (call via cron or pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_offline_agents()
RETURNS void AS $$
BEGIN
  UPDATE public.agents
  SET status = 'offline', updated_at = now()
  WHERE status != 'offline'
    AND id NOT IN (
      SELECT DISTINCT agent_id FROM public.agent_heartbeats
      WHERE created_at > now() - interval '5 minutes'
    )
    AND id IN (
      SELECT DISTINCT agent_id FROM public.agent_heartbeats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (run in Supabase dashboard if pg_cron available):
-- SELECT cron.schedule('mark-offline-agents', '*/2 * * * *', 'SELECT public.mark_offline_agents()');
