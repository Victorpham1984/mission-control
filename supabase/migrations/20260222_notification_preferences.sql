-- Phase 2A: Notification preferences + log table
-- Add notification columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN telegram_chat_id TEXT,
  ADD COLUMN preferred_channel TEXT DEFAULT 'dashboard' CHECK (preferred_channel IN ('dashboard', 'telegram', 'zalo', 'email')),
  ADD COLUMN notification_settings JSONB DEFAULT '{"task_completed": true, "task_approval_needed": true, "task_failed": true}';

-- Notification log table
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  task_id UUID REFERENCES public.task_queue(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message TEXT,
  error TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_log_user ON public.notification_log(user_id, created_at DESC);
CREATE INDEX idx_notification_log_task ON public.notification_log(task_id);
