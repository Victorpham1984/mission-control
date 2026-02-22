-- Phase 2B: Agent Persona & Memory System
-- Created: 2026-02-22 by Thép ⚙️
-- Week 7: Database Foundation

-- ============================================================
-- 1. agent_profiles — Persona & Memory per agent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,              -- 'minh', 'kien', 'thep', 'soi', 'phat', 'de'
  name TEXT NOT NULL,                  -- Display: "Minh 📋"
  avatar_url TEXT,
  persona TEXT NOT NULL,               -- System prompt (max 2000 chars)
  style_guide JSONB DEFAULT '{}',      -- { tone, emojiUsage, language }
  expertise_areas TEXT[] DEFAULT '{}',
  memory_context TEXT[] DEFAULT '{}',  -- Max 10 learnings
  performance_stats JSONB DEFAULT '{"total_tasks": 0, "avg_rating": 0, "trend": []}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_workspace ON public.agent_profiles(workspace_id);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_owner_agent_profiles" ON public.agent_profiles;
CREATE POLICY "workspace_owner_agent_profiles" ON public.agent_profiles
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- Service role bypass for API routes
DROP POLICY IF EXISTS "service_role_agent_profiles" ON public.agent_profiles;
CREATE POLICY "service_role_agent_profiles" ON public.agent_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. workspace_documents — Knowledge Base
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('brand_guideline', 'product_catalog', 'style_guide', 'other')),
  content TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_docs_workspace ON public.workspace_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_docs_type ON public.workspace_documents(workspace_id, type);

ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_owner_docs" ON public.workspace_documents;
CREATE POLICY "workspace_owner_docs" ON public.workspace_documents
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_docs" ON public.workspace_documents;
CREATE POLICY "service_role_docs" ON public.workspace_documents
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. agent_examples — Good/bad task examples for learning
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
  task_description TEXT,
  output_snippet TEXT,                 -- First 500 chars
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_examples_profile ON public.agent_examples(agent_profile_id, example_type);

ALTER TABLE public.agent_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_examples" ON public.agent_examples;
CREATE POLICY "service_role_examples" ON public.agent_examples
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. task_evaluations — Quality Scoring (Week 8)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  evaluator TEXT NOT NULL DEFAULT 'claude-opus-4',  -- model used
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  reasoning TEXT NOT NULL,
  criteria JSONB DEFAULT '{}',         -- { relevance, quality, tone, accuracy }
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id)  -- one evaluation per task
);

CREATE INDEX IF NOT EXISTS idx_task_evaluations_workspace ON public.task_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_evaluations_task ON public.task_evaluations(task_id);

ALTER TABLE public.task_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_evaluations" ON public.task_evaluations;
CREATE POLICY "service_role_evaluations" ON public.task_evaluations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Extend task_queue for feedback loop
-- ============================================================
ALTER TABLE public.task_queue
  ADD COLUMN IF NOT EXISTS feedback_text TEXT,
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

-- ============================================================
-- 6. updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS update_agent_profiles_updated_at ON public.agent_profiles;
CREATE TRIGGER update_agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_workspace_docs_updated_at ON public.workspace_documents;
CREATE TRIGGER update_workspace_docs_updated_at
  BEFORE UPDATE ON public.workspace_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
