-- Performance + safety index for playbook execution idempotency
-- The PlaybookExecutor uses `metadata @> '{"installed_playbook_id": "..."}' to check
-- for in-flight tasks before starting a new run. Without a GIN index, this is a seq scan.
--
-- Scaling note: acceptable for MVP (<10K tasks). At >100K tasks, consider a dedicated
-- playbook_runs table with a unique constraint on (installed_playbook_id, status='running').
-- See TODO in src/lib/playbooks/executor.ts.
--
-- Rollback: DROP INDEX IF EXISTS idx_task_queue_metadata_gin;

CREATE INDEX IF NOT EXISTS idx_task_queue_metadata_gin
  ON public.task_queue USING GIN (metadata);
