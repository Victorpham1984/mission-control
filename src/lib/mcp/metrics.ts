/**
 * MCPMetrics - Performance monitoring for MCP tool executions
 */

import { createClient } from '@supabase/supabase-js';

// Use service role for server-side metrics recording
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export class MCPMetrics {
  /**
   * Record a tool execution to the database
   */
  static async recordToolExecution(
    serverId: string,
    toolName: string,
    durationMs: number,
    success: boolean,
    error?: string,
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return; // Silently skip if no DB

    try {
      await supabase.from('mcp_tool_usage').insert({
        server_id: serverId,
        tool_name: toolName,
        duration_ms: durationMs,
        status: success ? 'success' : 'error',
        error_message: error ?? null,
      });
    } catch {
      // Don't fail tool execution because metrics recording failed
    }
  }

  /**
   * Get average latency for a tool over recent executions
   */
  static async getAverageLatency(
    serverId: string,
    toolName?: string,
    limit = 100,
  ): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;

    let query = supabase
      .from('mcp_tool_usage')
      .select('duration_ms')
      .eq('server_id', serverId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (toolName) {
      query = query.eq('tool_name', toolName);
    }

    const { data } = await query;
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, r) => sum + r.duration_ms, 0) / data.length;
  }

  /**
   * Get recent tool usage logs
   */
  static async getRecentUsage(limit = 50) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data } = await supabase
      .from('mcp_tool_usage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return data ?? [];
  }

  /**
   * Get error rate for a server
   */
  static async getErrorRate(serverId: string, windowMinutes = 60): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;

    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('mcp_tool_usage')
      .select('status')
      .eq('server_id', serverId)
      .gte('created_at', since);

    if (!data || data.length === 0) return 0;
    const errors = data.filter((r) => r.status === 'error').length;
    return errors / data.length;
  }
}
