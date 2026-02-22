-- Fix: ensure trigger function has proper search_path and permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
  );
  
  RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT INSERT ON public.workspaces TO supabase_auth_admin;
