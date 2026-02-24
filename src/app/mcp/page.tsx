'use client';

import { useState, useEffect, useCallback } from 'react';

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  created_at: string;
}

interface MCPToolInfo {
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface ToolResult {
  success: boolean;
  content?: Array<{ type: string; text?: string }>;
  error?: string;
  durationMs: number;
}

interface UsageLog {
  id: string;
  server_id: string;
  tool_name: string;
  duration_ms: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export default function MCPAdminPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add server form
  const [newServer, setNewServer] = useState({
    name: '',
    description: '',
    transport: 'stdio',
    command: '',
    args: '',
  });

  // Tool execution
  const [selectedTool, setSelectedTool] = useState<MCPToolInfo | null>(null);
  const [toolParams, setToolParams] = useState('{}');
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [executing, setExecuting] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/mcp/servers');
      const data = await res.json();
      if (data.servers) setServers(data.servers);
    } catch (e) {
      setError('Failed to fetch servers');
    }
  }, []);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/mcp/tools');
      const data = await res.json();
      if (data.tools) setTools(data.tools);
    } catch (e) {
      setError('Failed to fetch tools');
    }
  }, []);

  useEffect(() => {
    fetchServers();
    fetchTools();
  }, [fetchServers, fetchTools]);

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newServer,
          args: newServer.args
            ? newServer.args.split(',').map((a) => a.trim())
            : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNewServer({ name: '', description: '', transport: 'stdio', command: '', args: '' });
      await fetchServers();
      await fetchTools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add server');
    } finally {
      setLoading(false);
    }
  };

  const removeServer = async (id: string) => {
    if (!confirm('Remove this server?')) return;
    try {
      await fetch(`/api/v1/mcp/servers?id=${id}`, { method: 'DELETE' });
      await fetchServers();
      await fetchTools();
    } catch {
      setError('Failed to remove server');
    }
  };

  const executeTool = async () => {
    if (!selectedTool) return;
    setExecuting(true);
    setToolResult(null);

    try {
      const args = JSON.parse(toolParams);
      const res = await fetch('/api/v1/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: selectedTool.serverId,
          toolName: selectedTool.name,
          arguments: args,
        }),
      });
      const data = await res.json();
      setToolResult(data.result);
    } catch (e: unknown) {
      setToolResult({
        success: false,
        error: e instanceof Error ? e.message : 'Execution failed',
        durationMs: 0,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">🔧 MCP Admin Dashboard</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-bold">×</button>
        </div>
      )}

      {/* Servers Section */}
      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">📡 MCP Servers ({servers.length})</h2>

        <div className="grid gap-3 mb-6">
          {servers.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div>
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-gray-500 ml-2">
                  [{s.transport}] {s.command} {s.args?.join(' ')}
                </span>
                {s.description && <p className="text-sm text-gray-400">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${s.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {s.enabled ? '● Active' : '○ Disabled'}
                </span>
                <span className="text-xs text-gray-400">
                  {tools.filter((t) => t.serverId === s.id).length} tools
                </span>
                <button
                  onClick={() => removeServer(s.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {servers.length === 0 && (
            <p className="text-gray-500 text-sm">No servers configured. Add one below.</p>
          )}
        </div>

        {/* Add Server Form */}
        <form onSubmit={addServer} className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Add New Server</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Server name"
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              placeholder="Description (optional)"
              value={newServer.description}
              onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              placeholder="Command (e.g. npx)"
              value={newServer.command}
              onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              placeholder="Args (comma-separated)"
              value={newServer.args}
              onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Server'}
          </button>
        </form>
      </section>

      {/* Tools Section */}
      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">🛠 Available Tools ({tools.length})</h2>

        <div className="grid gap-2 max-h-96 overflow-y-auto">
          {tools.map((t) => (
            <button
              key={`${t.serverId}-${t.name}`}
              onClick={() => {
                setSelectedTool(t);
                setToolResult(null);
                setToolParams('{}');
              }}
              className={`text-left p-3 rounded border hover:bg-blue-50 dark:hover:bg-blue-900 transition ${
                selectedTool?.name === t.name && selectedTool?.serverId === t.serverId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-mono text-sm font-medium">{t.name}</div>
              <div className="text-xs text-gray-500">
                {t.serverName} · {t.description || 'No description'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tool Execution */}
      {selectedTool && (
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            ▶ Execute: <code className="text-blue-600">{selectedTool.name}</code>
          </h2>
          <p className="text-sm text-gray-500 mb-2">
            Server: {selectedTool.serverName} · {selectedTool.description}
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Parameters (JSON):</label>
              <textarea
                value={toolParams}
                onChange={(e) => setToolParams(e.target.value)}
                className="w-full border rounded px-3 py-2 font-mono text-sm h-24"
                placeholder='{"path": "/tmp/test.txt"}'
              />
            </div>

            <button
              onClick={executeTool}
              disabled={executing}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {executing ? 'Executing...' : 'Execute Tool'}
            </button>

            {toolResult && (
              <div className={`p-4 rounded border ${toolResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-medium ${toolResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {toolResult.success ? '✅ Success' : '❌ Error'}
                  </span>
                  <span className="text-xs text-gray-500">{toolResult.durationMs}ms</span>
                </div>
                {toolResult.error && (
                  <pre className="text-sm text-red-600 whitespace-pre-wrap">{toolResult.error}</pre>
                )}
                {toolResult.content?.map((c, i) => (
                  <pre key={i} className="text-sm whitespace-pre-wrap mt-2 bg-white dark:bg-gray-900 p-2 rounded">
                    {c.text}
                  </pre>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Schema Info */}
      {selectedTool && (
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">📋 Tool Schema</h2>
          <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
            {JSON.stringify(selectedTool.inputSchema, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
