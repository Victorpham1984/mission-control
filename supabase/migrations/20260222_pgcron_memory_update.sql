-- Phase 2B: Setup pg_cron for automated memory updates
-- Scheduled to run every 6 hours

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if exists (to avoid duplicates on re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('update-agent-memory');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN others THEN NULL;
END
$$;

-- Schedule memory update job every 6 hours
SELECT cron.schedule(
  'update-agent-memory',
  '0 */6 * * *',  -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://ceioktxdsxvbagycrveh.supabase.co/functions/v1/update-agent-memory',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlaW9rdHhkc3h2YmFneWNydmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjUxNzcsImV4cCI6MjA4Njg0MTE3N30.nBzQp7XoVyQctDxqB-bQAxXSLsHOeaLoVhkzsgS-7xU',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Grant execute on cron functions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
