-- Test: does the trigger fail because of workspaces FK, RLS, or something else?
-- Try inserting into workspaces with a dummy approach
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  ws_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Try workspace insert in a subtransaction
  BEGIN
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES ('Default', NEW.id::text, NEW.id)
    RETURNING id INTO ws_id;
  EXCEPTION WHEN OTHERS THEN
    -- Silently ignore workspace creation error for now
    -- User can still use the system, workspace can be created later
    NULL;
  END;
  
  RETURN NEW;
END;
$$;
