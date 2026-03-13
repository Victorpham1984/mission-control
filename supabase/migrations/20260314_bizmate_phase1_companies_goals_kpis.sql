-- BizMate Phase 1: companies + goals + kpis
-- Created: 2026-03-14
-- Purpose: CEO dashboard foundation — business entity, objectives, metrics
-- Rollback: DROP TABLE public.kpis, public.goals, public.companies CASCADE;

-- ============================================================
-- 1. companies — Business entity (1:1 per workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,                    -- 'ecommerce', 'content', 'service', 'f&b', 'other'
  team_size TEXT,                   -- '1-5', '6-20', '21-50', '50+'
  icp_segment TEXT DEFAULT 'sme'
    CHECK (icp_segment IN ('creator', 'sme', 'agency')),
  currency TEXT DEFAULT 'VND',
  settings JSONB DEFAULT '{}',     -- timezone, language, preferences
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE INDEX idx_companies_workspace ON public.companies(workspace_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_companies" ON public.companies
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- Service role bypass for API routes
CREATE POLICY "service_role_companies" ON public.companies
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. goals — Business objectives
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_value DECIMAL NOT NULL,
  current_value DECIMAL DEFAULT 0,
  unit TEXT NOT NULL,               -- 'orders', 'MRR', 'leads', 'posts', 'revenue'
  deadline DATE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_goals_company ON public.goals(company_id);
CREATE INDEX idx_goals_status ON public.goals(company_id, status);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_goals" ON public.goals
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_goals" ON public.goals
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. kpis — Key Performance Indicators
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('acquisition', 'activation', 'revenue', 'operations')),
  current_value DECIMAL DEFAULT 0,
  target_value DECIMAL,
  unit TEXT NOT NULL,               -- 'count', 'VND', '%', 'seconds'
  source TEXT,                      -- 'shopee_api', 'manual', 'agent_report', 'calculated'
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kpis_company ON public.kpis(company_id);
CREATE INDEX idx_kpis_company_category ON public.kpis(company_id, category);
CREATE INDEX idx_kpis_goal ON public.kpis(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_kpis" ON public.kpis
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_kpis" ON public.kpis
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. updated_at auto-trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.bizmate_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.bizmate_set_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.bizmate_set_updated_at();

CREATE TRIGGER kpis_updated_at
  BEFORE UPDATE ON public.kpis
  FOR EACH ROW EXECUTE FUNCTION public.bizmate_set_updated_at();
