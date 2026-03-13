-- Day 1: Fix founder trigger + add task_comments
-- 2026-03-17

-- ============================================================
-- 1. Fix handle_new_workspace_founder() — remove non-existent columns
--    (role, about, avatar_emoji don't exist on agents table)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_workspace_founder()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  owner_profile RECORD;
BEGIN
  SELECT full_name, avatar_url FROM public.profiles WHERE id = NEW.owner_id INTO owner_profile;

  INSERT INTO public.agents (workspace_id, name, type, status, config, description)
  VALUES (
    NEW.id,
    COALESCE(owner_profile.full_name, 'Founder'),
    'founder',
    'online',
    '{"badge": "founder", "color": "#f59e0b", "role": "Founder", "avatar_emoji": "👑"}'::jsonb,
    'Workspace founder & owner'
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. task_comments — comments on tasks (realtime enabled)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_workspace ON public.task_comments(workspace_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_task_comments" ON public.task_comments
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "service_role_task_comments" ON public.task_comments
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
