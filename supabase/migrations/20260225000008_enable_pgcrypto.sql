-- Enable pgcrypto extension (needed by workspace API key generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Also update handle_new_workspace_api_key to use the correct schema
CREATE OR REPLACE FUNCTION public.handle_new_workspace_api_key()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
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
$$;

-- Also fix handle_new_user to properly create workspace
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
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || chr(39) || 's Workspace',
    NEW.id::text,
    NEW.id
  );
  
  RETURN NEW;
END;
$$;
