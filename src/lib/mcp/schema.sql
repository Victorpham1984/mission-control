-- MCP Phase 3: Database Schema
-- Run in Supabase SQL Editor

-- ============================================================
-- MCP Servers Configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  transport TEXT NOT NULL DEFAULT 'stdio' CHECK (transport IN ('stdio', 'sse')),
  command TEXT,
  args JSONB DEFAULT '[]'::jsonb,
  env JSONB DEFAULT '{}'::jsonb,
  url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  timeout INTEGER NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_mcp_servers_workspace ON public.mcp_servers(workspace_id);
CREATE INDEX idx_mcp_servers_enabled ON public.mcp_servers(workspace_id, enabled);

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MCP Tool Usage / Metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mcp_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.mcp_servers(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_tool_usage_server ON public.mcp_tool_usage(server_id, created_at DESC);
CREATE INDEX idx_mcp_tool_usage_tool ON public.mcp_tool_usage(tool_name, created_at DESC);
CREATE INDEX idx_mcp_tool_usage_status ON public.mcp_tool_usage(server_id, status);

ALTER TABLE public.mcp_tool_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Performance: Materialized View for Tool Stats
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mcp_tool_stats AS
SELECT
  server_id,
  tool_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  AVG(duration_ms) FILTER (WHERE status = 'success') as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  MIN(duration_ms) FILTER (WHERE status = 'success') as min_duration_ms,
  MAX(created_at) as last_used_at
FROM public.mcp_tool_usage
GROUP BY server_id, tool_name;

CREATE UNIQUE INDEX idx_mcp_tool_stats_pk ON public.mcp_tool_stats(server_id, tool_name);

-- Refresh function (call periodically or after batches)
CREATE OR REPLACE FUNCTION refresh_mcp_tool_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mcp_tool_stats;
END;
$$ LANGUAGE plpgsql;
