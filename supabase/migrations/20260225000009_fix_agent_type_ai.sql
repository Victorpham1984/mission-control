-- BUG-006: Add 'ai' to agents_type_check constraint
-- Frontend sends type: "ai" but constraint only allowed: openclaw, crewai, custom, founder
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_type_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_type_check CHECK (type IN ('openclaw', 'crewai', 'custom', 'founder', 'ai'));
