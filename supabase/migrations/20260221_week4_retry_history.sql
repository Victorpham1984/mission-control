-- Week 4: Retry Logic, Reassign Flow, Task History
-- Created: 2026-02-21 by Thép ⚙️

-- ============================================================
-- 1. Add retry_count and reassignment_count to task_queue
-- ============================================================
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS reassignment_count INTEGER DEFAULT 0;

-- Add 'failed_permanent' to status check constraint
ALTER TABLE public.task_queue DROP CONSTRAINT IF EXISTS task_queue_status_check;
ALTER TABLE public.task_queue ADD CONSTRAINT task_queue_status_check 
  CHECK (status IN ('queued', 'assigned', 'in-progress', 'pending-approval', 'completed', 'failed', 'failed_permanent', 'cancelled'));

-- ============================================================
-- 2. task_history table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_queue(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT, -- agent_id UUID or 'system'
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task ON public.task_history(task_id, created_at DESC);

ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_owner_task_history" ON public.task_history;
CREATE POLICY "workspace_owner_task_history" ON public.task_history
  FOR ALL USING (
    task_id IN (
      SELECT tq.id FROM public.task_queue tq
      JOIN public.workspaces w ON tq.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );
