# MCP Setup Guide — CommandMate Phase 3

## Quick Start

### 1. Install Dependencies
```bash
npm install @modelcontextprotocol/sdk
npm install -D @modelcontextprotocol/server-filesystem  # For testing
```

### 2. Run Database Migration
Execute `src/lib/mcp/schema.sql` in Supabase SQL Editor.

### 3. Add a Filesystem Server (via API)
```bash
curl -X POST http://localhost:3000/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "filesystem",
    "transport": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
  }'
```

### 4. Discover Tools
```bash
curl http://localhost:3000/api/v1/mcp/tools
```

### 5. Execute a Tool
```bash
curl -X POST http://localhost:3000/api/v1/mcp/tools \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "<server-id>",
    "toolName": "read_file",
    "arguments": {"path": "/path/to/file.txt"}
  }'
```

### 6. Admin UI
Navigate to `/mcp` in your browser for the admin dashboard.

---

## Adding GitHub Server

### Prerequisites
- GitHub Personal Access Token with `repo` scope

### Setup
```bash
npm install @modelcontextprotocol/server-github
```

Add via API or Admin UI:
```json
{
  "name": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-github"],
  "env": {"GITHUB_TOKEN": "ghp_your_token_here"}
}
```

### Available GitHub Tools
- `create_issue` - Create a GitHub issue
- `get_issue` - Get issue details
- `list_issues` - List repository issues
- `create_pull_request` - Create a PR
- `search_repositories` - Search repos
- `get_file_contents` - Read file from repo

---

## Architecture

```
User Request → Next.js API Route → MCPServerRegistry
                                          ↓
                        ┌─────────────────┼─────────────────┐
                        ↓                 ↓                 ↓
                  MCPClient          MCPClient         MCPClient
                  (Filesystem)       (GitHub)          (Memory)
                        ↓                 ↓                 ↓
                  MCP Server        MCP Server        MCP Server
                        ↓                 ↓                 ↓
                  Local Files      GitHub API        Redis/DB
```

### Key Components
- **MCPClient** (`src/lib/mcp/MCPClient.ts`): Single server connection with retry, circuit breaker, caching
- **MCPServerRegistry** (`src/lib/mcp/MCPServerRegistry.ts`): Multi-server management
- **MCPMetrics** (`src/lib/mcp/metrics.ts`): Performance monitoring to Supabase

---

## Error Handling

### Retry Logic
- 3 retries with exponential backoff (1s, 2s, 4s)
- Only retries transient errors: timeout, ECONNREFUSED, ECONNRESET

### Circuit Breaker
- Opens after 5 failures in 1 minute
- Auto-resets after 60 seconds (half-open state)
- When open: fails fast with clear error message

### Enriched Errors
All errors include: `MCP Error [server/tool]: message`

---

## Troubleshooting

### Server won't connect
1. Check command exists: `which npx`
2. Verify server package installed: `npx @modelcontextprotocol/server-filesystem --help`
3. Check args are correct (filesystem server needs allowed directory path)

### "Access denied - path outside allowed directories"
- macOS: temp dirs resolve through `/private/var/`. Use `fs.realpathSync()` to get real path
- Filesystem server only allows access within specified directories

### Tool execution timeout
- Default timeout: 30 seconds
- Increase per-server: set `timeout` field in server config (milliseconds)
- Large files may need >30s

### Circuit breaker open
- Server had 5+ failures in 1 minute
- Wait 60 seconds for auto-reset, or restart server
- Check server health: verify the MCP server process is running

---

## Security Best Practices

1. **API keys in env vars** — Never hardcode tokens in database. Use `env` field which is stored encrypted.
2. **Filesystem isolation** — Each filesystem server should only access its designated directory.
3. **RLS policies** — Supabase RLS ensures workspace isolation.
4. **Token rotation** — Rotate GitHub/API tokens regularly.

---

## Performance Tuning

| Scenario | Recommendation |
|----------|---------------|
| Frequent `listTools()` | Tool cache TTL is 5 min. Increase for stable servers. |
| Many concurrent requests | STDIO servers handle requests sequentially. Use multiple server instances for parallelism. |
| High latency | Check `mcp_tool_usage` table for slow tools. Consider caching results. |
| Server startup slow | `npx` downloads on first run. Pre-install packages: `npm install -D @modelcontextprotocol/server-*` |

---

## API Reference

### `GET /api/v1/mcp/servers`
List all configured MCP servers.

### `POST /api/v1/mcp/servers`
Add a new MCP server.

**Body:**
```json
{
  "name": "string (required)",
  "transport": "stdio | sse (required)",
  "command": "string",
  "args": ["string[]"],
  "env": {"KEY": "VALUE"},
  "description": "string",
  "timeout": 30000
}
```

### `DELETE /api/v1/mcp/servers?id=<uuid>`
Remove an MCP server.

### `GET /api/v1/mcp/tools`
List all tools from all enabled servers.

### `POST /api/v1/mcp/tools`
Execute a tool.

**Body:**
```json
{
  "serverId": "uuid (required)",
  "toolName": "string (required)",
  "arguments": {}
}
```

**Response:**
```json
{
  "result": {
    "success": true,
    "content": [{"type": "text", "text": "..."}],
    "durationMs": 5
  }
}
```
