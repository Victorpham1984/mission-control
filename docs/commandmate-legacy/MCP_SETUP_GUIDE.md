# MCP Setup Guide - CommandMate Phase 3

## Prerequisites
- Node.js 18+ (project uses v22)
- npm installed

## 1. Install Dependencies

```bash
cd ~/mission-control-deploy
npm install @modelcontextprotocol/sdk
npm install @modelcontextprotocol/server-filesystem  # For testing
```

## 2. Test MCP Client (Standalone)

```bash
npx tsx src/lib/mcp/__tests__/filesystem-test.ts
```

Expected: All 8 tests pass, connecting to filesystem server via STDIO.

## 3. Run Demo

```bash
npx tsx scripts/mcp-demo.ts
```

Shows: MCPClient + MCPServerRegistry working with filesystem server (14 tools).

## 4. Add MCP Server via API

```bash
# Add filesystem server
curl -X POST http://localhost:3000/api/v1/mcp/servers \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Filesystem",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
  }'
```

## 5. Execute Tool via API

```bash
curl -X POST http://localhost:3000/api/v1/mcp/tools \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "SERVER_UUID",
    "tool_name": "read_file",
    "arguments": { "path": "/path/to/file.txt" }
  }'
```

## 6. Apply Database Migration

```bash
# Via Supabase CLI
supabase db push

# Or manually apply:
# supabase/migrations/20260224_phase3_mcp_servers.sql
```

Creates tables: `mcp_servers`, `mcp_tools`, `mcp_tool_usage`

## Architecture

```
MCPClient (single server connection)
  ↳ connect() → spawn STDIO process → JSON-RPC handshake
  ↳ listTools() → cached for 60s
  ↳ callTool() → execute with timeout (30s default)
  ↳ disconnect() → graceful shutdown

MCPServerRegistry (multi-server management)
  ↳ registerServer() → store config
  ↳ connectServer() → create MCPClient
  ↳ listAllTools() → aggregate tools across servers
  ↳ executeToolByName() → find server + execute
  ↳ idle timeout → auto-disconnect after 5min
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| `spawn ENOENT` | Ensure `npx` is in PATH |
| `Schema is missing a method literal` | Use `ToolListChangedNotificationSchema` from `@modelcontextprotocol/sdk/types.js` |
| `Timeout after 30000ms` | Increase `timeout` in MCPClientConfig |
| Connection hangs | Check if server process started (stderr output) |
| `Tool not found` | Call `listTools()` first to verify available tools |

## File Structure

```
src/lib/mcp/
├── MCPClient.ts           # Core client (single server)
├── MCPServerRegistry.ts   # Multi-server manager
├── index.ts               # Exports
└── __tests__/
    └── filesystem-test.ts # Integration test

src/app/api/v1/mcp/
├── servers/route.ts       # CRUD for MCP servers
└── tools/route.ts         # List & execute tools

supabase/migrations/
└── 20260224_phase3_mcp_servers.sql  # DB schema

scripts/
└── mcp-demo.ts            # Demo script
```
