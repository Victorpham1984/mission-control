-- Create debug table to capture error
CREATE TABLE IF NOT EXISTS public._trigger_debug (
  id serial primary key,
  error_msg text,
  error_detail text,
  error_hint text,
  sqlstate text,
  created_at timestamptz default now()
);

-- Grant insert to postgres (trigger runs as postgres via SECURITY DEFINER)
GRANT ALL ON public._trigger_debug TO postgres;
GRANT ALL ON SEQUENCE public._trigger_debug_id_seq TO postgres;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  ws_id uuid;
  err_msg text;
  err_detail text;
  err_hint text;
  err_state text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Try workspace insert
  BEGIN
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES ('Default', NEW.id::text, NEW.id)
    RETURNING id INTO ws_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_msg = MESSAGE_TEXT,
      err_detail = PG_EXCEPTION_DETAIL,
      err_hint = PG_EXCEPTION_HINT,
      err_state = RETURNED_SQLSTATE;
    
    INSERT INTO public._trigger_debug (error_msg, error_detail, error_hint, sqlstate)
    VALUES (err_msg, err_detail, err_hint, err_state);
  END;
  
  RETURN NEW;
END;
$$;
