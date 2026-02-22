# pg_cron Setup — Phase 2B

## Quick Setup (Supabase Dashboard)

1. Go to: https://supabase.com/dashboard/project/ceioktxdsxvbagycrveh/sql

2. Paste and run this SQL:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if exists (avoid duplicates)
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

-- Grant execute permission
GRANT USAGE ON SCHEMA cron TO postgres;
```

3. Verify setup:

```sql
-- Check scheduled job
SELECT * FROM cron.job WHERE jobname = 'update-agent-memory';

-- Check job history (after first run)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-agent-memory')
ORDER BY start_time DESC 
LIMIT 5;
```

## What It Does

- Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Calls Edge Function: `update-agent-memory`
- Edge Function:
  - Fetches recent high-rated tasks (rating ≥ 4)
  - Fetches rejected tasks
  - Updates agent `memory_context` with learnings
  - Returns: `{"success": true, "updated": N, "total_agents": 6}`

## Manual Trigger (for testing)

```bash
curl -X POST \
  'https://ceioktxdsxvbagycrveh.supabase.co/functions/v1/update-agent-memory' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlaW9rdHhkc3h2YmFneWNydmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjUxNzcsImV4cCI6MjA4Njg0MTE3N30.nBzQp7XoVyQctDxqB-bQAxXSLsHOeaLoVhkzsgS-7xU' \
  -H 'Content-Type: application/json'
```

Expected response:
```json
{"success":true,"updated":2,"total_agents":6}
```

## Troubleshooting

### If pg_cron extension not available:
Supabase free tier might not support pg_cron. Alternative:
- Set up external cron (e.g., GitHub Actions, cron-job.org) to hit Edge Function URL

### Check if pg_cron is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Uninstall (if needed):
```sql
SELECT cron.unschedule('update-agent-memory');
DROP EXTENSION pg_cron;
```
