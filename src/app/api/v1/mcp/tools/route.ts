import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MCPMetrics } from '@/lib/mcp/metrics';
import { getSharedRegistry } from '@/lib/mcp/registry-singleton';
import type { MCPServerConfig } from '@/lib/mcp/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: servers } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('enabled', true);

  if (!servers || servers.length === 0) {
    return NextResponse.json({ tools: [] });
  }

  const reg = getSharedRegistry();
  const allTools: Array<{ serverId: string; serverName: string; name: string; description?: string; inputSchema: any }> = [];

  for (const server of servers) {
    try {
      // Ensure server is registered
      if (!reg.getClient(server.id)) {
        await reg.addServer(server as MCPServerConfig);
      }
      const tools = await reg.listTools(server.id);
      for (const tool of tools) {
        allTools.push({
          serverId: server.id,
          serverName: server.name,
          ...tool,
        });
      }
    } catch {
      // Skip servers that fail
    }
  }

  return NextResponse.json({ tools: allTools });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { serverId, toolName, arguments: args } = body;

  if (!serverId || !toolName) {
    return NextResponse.json({ error: 'serverId and toolName are required' }, { status: 400 });
  }

  // Get server config from DB
  const { data: server } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .single();

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const reg = getSharedRegistry();

  // Ensure server is registered
  if (!reg.getClient(serverId)) {
    await reg.addServer(server as MCPServerConfig);
  }

  const result = await reg.callTool(serverId, toolName, args ?? {});

  // Record metrics
  await MCPMetrics.recordToolExecution(
    serverId,
    toolName,
    result.durationMs,
    result.success,
    result.error,
  );

  return NextResponse.json({ result });
}
