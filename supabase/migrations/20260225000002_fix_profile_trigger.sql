-- Drop the problematic on_profile_created trigger
-- Workspace creation will be handled by handle_new_user instead
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- Update handle_new_user to create both profile AND workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Create default workspace
  INSERT INTO public.workspaces (id, name, slug, owner_id, plan, settings, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || chr(39) || 's Workspace',
    NEW.id::text,
    NEW.id,
    'starter',
    '{}'::jsonb,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_workspace_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
