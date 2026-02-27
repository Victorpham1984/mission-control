import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper: get user's workspace (owner-based, no workspace_members needed)
async function getUserWorkspaceId(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string): Promise<string | null> {
  // Try workspace_members first
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .single();
  if (member) return member.workspace_id;

  // Fallback: check workspaces.owner_id
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .single();
  if (workspace) return workspace.id;

  return null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await getUserWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    // No workspace at all — return empty list instead of error
    return NextResponse.json({ servers: [] });
  }

  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ servers: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, description, transport, command, args, env, url, timeout } = body;

  if (!name || !transport) {
    return NextResponse.json({ error: 'name and transport are required' }, { status: 400 });
  }

  const workspaceId = await getUserWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found. Please create a workspace first.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('mcp_servers')
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      transport,
      command,
      args: args ?? [],
      env: env ?? {},
      url,
      timeout: timeout ?? 30000,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ server: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const workspaceId = await getUserWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Server not found or access denied' }, { status: 404 });
  }

  return NextResponse.json({ success: true, deleted: data[0] });
}
