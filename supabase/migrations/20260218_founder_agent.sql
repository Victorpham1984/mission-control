-- Migration: Add founder agent type and auto-creation trigger
-- Run this in Supabase SQL Editor

-- 1. Update type constraint
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_type_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_type_check CHECK (type IN ('openclaw', 'crewai', 'custom', 'founder'));

-- 2. Create trigger function for auto-creating founder agent
CREATE OR REPLACE FUNCTION public.handle_new_workspace_founder()
RETURNS TRIGGER AS $$
DECLARE
  owner_profile RECORD;
BEGIN
  SELECT full_name, avatar_url FROM public.profiles WHERE id = NEW.owner_id INTO owner_profile;

  INSERT INTO public.agents (workspace_id, name, type, role, about, avatar_emoji, status, config, description)
  VALUES (
    NEW.id,
    COALESCE(owner_profile.full_name, 'Founder'),
    'founder',
    'Founder',
    'Workspace founder & owner',
    '👑',
    'online',
    '{"badge": "founder", "color": "#f59e0b"}'::jsonb,
    'Auto-created founder agent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created_founder ON public.workspaces;
CREATE TRIGGER on_workspace_created_founder
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_founder();

-- 3. Create founder agent for existing workspace (Victor)
INSERT INTO public.agents (workspace_id, name, type, role, about, avatar_emoji, status, config, description)
VALUES (
  '4d108722-a005-4516-a0ba-89ed4a22debf',
  'Victor',
  'founder',
  'Founder',
  'Workspace founder & owner',
  '👑',
  'online',
  '{"badge": "founder", "color": "#f59e0b"}'::jsonb,
  'Founder agent'
);
