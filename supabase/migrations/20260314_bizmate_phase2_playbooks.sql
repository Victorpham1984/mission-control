-- BizMate Phase 2: playbooks + installed_playbooks + actions
-- Created: 2026-03-14
-- Purpose: Automation engine — playbook marketplace, company installs, action logging
-- Depends on: 20260314_bizmate_phase1_companies_goals_kpis.sql
-- Rollback: DROP TABLE public.actions, public.installed_playbooks, public.playbooks CASCADE;

-- ============================================================
-- 1. playbooks — Workflow templates (global marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('ecommerce', 'content', 'b2b', 'operations', 'marketing')),
  author_id UUID REFERENCES public.profiles(id),  -- NULL = system template
  config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_playbooks_category ON public.playbooks(category);
CREATE INDEX idx_playbooks_public ON public.playbooks(is_public) WHERE is_public = true;

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- Public read for marketplace (anyone can browse public playbooks)
CREATE POLICY "public_read_playbooks" ON public.playbooks
  FOR SELECT USING (is_public = true);

-- Author can manage their own playbooks
CREATE POLICY "author_manage_playbooks" ON public.playbooks
  FOR ALL USING (author_id = auth.uid());

-- Service role full access (system templates, API routes)
CREATE POLICY "service_role_playbooks" ON public.playbooks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. installed_playbooks — Company-specific instances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.installed_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  customization JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  schedule TEXT,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, playbook_id)
);

CREATE INDEX idx_installed_playbooks_company ON public.installed_playbooks(company_id);
CREATE INDEX idx_installed_playbooks_active ON public.installed_playbooks(company_id, active);

ALTER TABLE public.installed_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_installed_playbooks" ON public.installed_playbooks
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_installed_playbooks" ON public.installed_playbooks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. actions — Business operations log (billing basis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  installed_playbook_id UUID REFERENCES public.installed_playbooks(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.task_queue(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  success BOOLEAN DEFAULT false,
  evidence JSONB DEFAULT '{}',
  cost DECIMAL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes (heavy read/write table)
CREATE INDEX idx_actions_company_created ON public.actions(company_id, created_at DESC);
CREATE INDEX idx_actions_type ON public.actions(company_id, action_type);
CREATE INDEX idx_actions_playbook ON public.actions(installed_playbook_id)
  WHERE installed_playbook_id IS NOT NULL;
CREATE INDEX idx_actions_task ON public.actions(task_id)
  WHERE task_id IS NOT NULL;

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_actions" ON public.actions
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_actions" ON public.actions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. updated_at triggers (playbooks only — actions are append-only)
-- ============================================================
CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.bizmate_set_updated_at();

-- ============================================================
-- 5. install_count auto-increment trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_playbook_install_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.playbooks
  SET install_count = install_count + 1
  WHERE id = NEW.playbook_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_playbook_installed
  AFTER INSERT ON public.installed_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.increment_playbook_install_count();
