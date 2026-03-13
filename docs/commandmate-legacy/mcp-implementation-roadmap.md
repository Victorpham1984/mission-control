# MCP Implementation Roadmap
**CommandMate Phase 3: 8-Week Sprint Plan**  
**Author:** Minh 📋 (Business Analyst / Project Manager)  
**Date:** February 24, 2026  
**Version:** 1.0

---

## Executive Summary

This roadmap breaks down the MCP integration project into **4 two-week sprints**, with clear deliverables, success criteria, and risk mitigation strategies.

**Timeline:** 8 weeks (February 24 - April 20, 2026)  
**Budget:** ~$65 (OpenAI API + development time)  
**Team:** Thép ⚙️ (Dev Lead), Minh 📋 (PM/BA), Sếp (Product Owner)

**Key Milestones:**
- Week 2: MCP client prototype working
- Week 4: 5 servers integrated + admin UI
- Week 6: CommandMate MCP server live (Claude Desktop integration)
- Week 8: Production deployment + documentation

---

## Sprint Overview

| Sprint | Weeks | Focus | Deliverables |
|--------|-------|-------|--------------|
| **Sprint 1** | 1-2 | MCP Foundation | Client manager, STDIO transport, 1 server |
| **Sprint 2** | 3-4 | Core Servers | HTTP transport, 5 servers, admin UI |
| **Sprint 3** | 5-6 | MCP Server | CommandMate server, Claude integration |
| **Sprint 4** | 7-8 | Polish & Launch | Testing, docs, deployment |

---

## Sprint 1: MCP Foundation (Weeks 1-2)

### Goals

✅ Prove MCP can work in Next.js environment  
✅ Build reusable MCP client infrastructure  
✅ Integrate first server (filesystem) via STDIO  
✅ Demonstrate end-to-end tool execution flow

### Week 1: Core Infrastructure

#### Day 1-2: Database Schema & Setup

**Tasks:**
1. Create Prisma schema for `mcp_servers` and `mcp_tool_calls` tables
2. Run migrations on staging database
3. Set up Supabase Vault for credential encryption
4. Install MCP SDK: `npm install @modelcontextprotocol/sdk zod`

**Deliverables:**
```prisma
// prisma/schema.prisma (additions)
model MCP_Server {
  id              String   @id @default(cuid())
  name            String   @unique
  description     String?
  transport       String   // "stdio" | "http"
  command         String?
  args            String[]
  encryptedEnv    String?  // Vault ID
  url             String?
  encryptedToken  String?  // Vault ID
  enabled         Boolean  @default(true)
  autoConnect     Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  toolCalls       MCP_ToolCall[]
  @@index([enabled, autoConnect])
}

model MCP_ToolCall {
  id              String   @id @default(cuid())
  serverId        String
  server          MCP_Server @relation(fields: [serverId], references: [id])
  toolName        String
  arguments       Json
  result          Json
  duration        Int
  success         Boolean
  error           String?
  userId          String?
  agentId         String?
  taskId          String?
  createdAt       DateTime @default(now())
  @@index([serverId, createdAt])
  @@index([toolName, createdAt])
}
```

**Success Criteria:**
- ✅ Tables created in Supabase
- ✅ Can insert/query MCP server configs
- ✅ Vault encryption/decryption working

---

#### Day 3-4: MCP Client Manager (Core)

**Tasks:**
1. Create `src/server/mcp/client/manager.ts`
2. Implement `MCPClientManager` class
3. Implement `MCPClientWrapper` for single server connection
4. Add basic STDIO transport support

**Code Structure:**
```typescript
// src/server/mcp/client/manager.ts
export class MCPClientManager {
  private clients: Map<string, MCPClientWrapper>;
  
  async initialize(): Promise<void>;
  async connectServer(serverId: string): Promise<void>;
  async disconnectServer(serverId: string): Promise<void>;
  async executeTool(serverId: string, toolName: string, args: any): Promise<CallToolResult>;
  async listAllTools(): Promise<Tool[]>;
}

// src/server/mcp/client/wrapper.ts
export class MCPClientWrapper {
  async connect(): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: any): Promise<CallToolResult>;
  async disconnect(): Promise<void>;
}
```

**Success Criteria:**
- ✅ Can spawn a child process for STDIO server
- ✅ Can send `initialize` request and receive response
- ✅ Can list tools from connected server
- ✅ Can execute a simple tool (e.g., `get_time`)

---

#### Day 5: Filesystem Server Integration

**Tasks:**
1. Clone filesystem server from MCP repo
2. Configure allowed directories
3. Test `read_file`, `write_file`, `list_directory`
4. Add filesystem server to database

**Server Setup:**
```bash
# Clone MCP servers repo
cd /tmp
git clone https://github.com/modelcontextprotocol/servers.git
cd servers/src/filesystem
npm install
npm run build

# Copy to CommandMate project
cp -r /tmp/servers/src/filesystem ~/commandmate/mcp-servers/filesystem
```

**Config in Database:**
```sql
INSERT INTO "MCP_Server" (id, name, transport, command, args, enabled) VALUES (
  'fs-local',
  'Filesystem',
  'stdio',
  'node',
  ARRAY['/absolute/path/to/commandmate/mcp-servers/filesystem/build/index.js'],
  true
);
```

**Success Criteria:**
- ✅ Filesystem server starts without errors
- ✅ Can list files in allowed directory
- ✅ Can read file contents
- ✅ Can write file contents

---

### Week 2: tRPC Integration & Testing

#### Day 6-7: tRPC API Routes

**Tasks:**
1. Create `src/server/api/routers/mcp.ts`
2. Implement CRUD for MCP servers
3. Implement tool execution endpoint
4. Add error handling & logging

**Endpoints:**
```typescript
export const mcpRouter = createTRPCRouter({
  // Server management
  listServers: protectedProcedure.query(),
  getServer: protectedProcedure.input(z.object({ id: z.string() })).query(),
  addServer: protectedProcedure.input(AddServerSchema).mutation(),
  updateServer: protectedProcedure.input(UpdateServerSchema).mutation(),
  deleteServer: protectedProcedure.input(z.object({ id: z.string() })).mutation(),
  
  // Tool operations
  listTools: protectedProcedure.query(),
  executeTool: protectedProcedure.input(ExecuteToolSchema).mutation(),
  getToolHistory: protectedProcedure.input(z.object({ 
    serverId: z.string().optional(),
    limit: z.number().default(50)
  })).query(),
});
```

**Success Criteria:**
- ✅ Can add server via tRPC
- ✅ Can list all tools via tRPC
- ✅ Can execute tool via tRPC
- ✅ Tool calls are logged to database

---

#### Day 8-9: Basic Admin UI

**Tasks:**
1. Create page: `/dashboard/mcp/servers`
2. Build server list component
3. Build "Add Server" form (STDIO only for now)
4. Build "Test Connection" button

**UI Components:**
```tsx
// src/pages/dashboard/mcp/servers.tsx
export default function MCPServersPage() {
  const { data: servers } = api.mcp.listServers.useQuery();
  const addServer = api.mcp.addServer.useMutation();
  
  return (
    <div>
      <h1>MCP Servers</h1>
      <ServerList servers={servers} />
      <AddServerDialog onSubmit={addServer.mutate} />
    </div>
  );
}

// src/components/mcp/ServerList.tsx
// src/components/mcp/AddServerDialog.tsx
```

**Success Criteria:**
- ✅ Can see list of servers in UI
- ✅ Can add filesystem server via form
- ✅ Can test connection (shows green/red status)
- ✅ UI shows tool count per server

---

#### Day 10: Integration Testing & Documentation

**Tasks:**
1. Write integration tests for MCP flow
2. Test error scenarios (server crash, timeout, invalid args)
3. Document setup process
4. Create demo video

**Test Cases:**
```typescript
// __tests__/mcp-integration.test.ts

describe("MCP Integration", () => {
  it("should connect to filesystem server", async () => {
    const manager = new MCPClientManager(db);
    await manager.connectServer("fs-local");
    expect(manager.clients.has("fs-local")).toBe(true);
  });
  
  it("should list tools from filesystem server", async () => {
    const tools = await manager.listAllTools();
    expect(tools).toContainEqual(expect.objectContaining({
      name: "read_file"
    }));
  });
  
  it("should execute read_file tool", async () => {
    const result = await manager.executeTool("fs-local", "read_file", {
      path: "/tmp/test.txt"
    });
    expect(result.content[0].text).toBe("Hello, MCP!");
  });
  
  it("should handle server timeout", async () => {
    await expect(
      manager.executeTool("fs-local", "slow_tool", {}, { timeout: 100 })
    ).rejects.toThrow("Timeout");
  });
});
```

**Success Criteria:**
- ✅ All integration tests pass
- ✅ Error handling works (timeout, invalid tool, server crash)
- ✅ Setup documentation complete
- ✅ Demo video recorded (2 minutes)

---

### Sprint 1 Deliverables

**Code:**
- ✅ MCP Client Manager (STDIO transport)
- ✅ Filesystem server integrated
- ✅ tRPC API routes
- ✅ Basic admin UI

**Documentation:**
- ✅ Setup guide for developers
- ✅ API documentation
- ✅ Demo video

**Metrics:**
- ✅ 1 MCP server connected
- ✅ 4 tools available (read_file, write_file, list_directory, create_directory)
- ✅ <500ms average tool latency
- ✅ 100% test coverage for core manager

---

### Sprint 1 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Next.js can't spawn processes | Low | High | Test early (Day 1), fallback to separate Node service |
| STDIO transport unreliable | Medium | Medium | Add reconnection logic, health checks |
| Child process memory leaks | Medium | Low | Implement process pooling with timeouts |
| TypeScript complexity | Low | Low | Team already familiar with TS |

**Go/No-Go Decision (End of Week 2):**
- ✅ Filesystem server working end-to-end
- ✅ Tool execution latency <500ms
- ✅ No critical bugs
- ✅ Sếp approves demo

If **any criteria fails**, pause and reassess before Sprint 2.

---

## Sprint 2: Core Servers Integration (Weeks 3-4)

### Goals

✅ Add HTTP transport support  
✅ Integrate 4 more MCP servers (GitHub, Slack, Memory, Time)  
✅ Build production-ready admin UI  
✅ Implement connection pooling & caching

### Week 3: HTTP Transport & GitHub Integration

#### Day 11-12: HTTP Transport Implementation

**Tasks:**
1. Implement HTTP client transport
2. Add OAuth 2.0 auth flow
3. Test with a simple HTTP server

**Code:**
```typescript
// src/server/mcp/client/transports/http.ts
export class HttpClientTransport implements Transport {
  constructor(private config: HttpTransportConfig) {}
  
  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const response = await fetch(this.config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.token}`
      },
      body: JSON.stringify(request)
    });
    
    return await response.json();
  }
  
  async subscribe(callback: (message: JsonRpcMessage) => void): Promise<void> {
    // Use Server-Sent Events for notifications
    const eventSource = new EventSource(
      `${this.config.url}/events`,
      { headers: { "Authorization": `Bearer ${this.config.token}` } }
    );
    
    eventSource.onmessage = (event) => {
      callback(JSON.parse(event.data));
    };
  }
}
```

**Success Criteria:**
- ✅ Can connect to HTTP MCP server
- ✅ Can send requests and receive responses
- ✅ Can receive SSE notifications
- ✅ OAuth token refresh works

---

#### Day 13-14: GitHub Server Integration

**Tasks:**
1. Set up GitHub OAuth app
2. Build OAuth callback handler
3. Connect to GitHub MCP server
4. Test GitHub tools (create_pr, list_issues, search_code)

**OAuth Flow:**
```
1. User clicks "Connect GitHub" in UI
2. Redirect to: https://github.com/login/oauth/authorize?client_id=XXX
3. User approves
4. GitHub redirects to: /api/auth/github/callback?code=YYY
5. Exchange code for access token
6. Store encrypted token in Vault
7. Add GitHub server to database with token
```

**GitHub Server Tools:**
- `create_pull_request`
- `list_issues`
- `search_code`
- `create_issue`
- `add_comment`
- `list_repositories`

**Success Criteria:**
- ✅ OAuth flow works end-to-end
- ✅ Can create a PR via MCP
- ✅ Can search code in repos
- ✅ Token refresh works before expiry

---

#### Day 15: Slack Server Integration

**Tasks:**
1. Set up Slack OAuth app
2. Connect to Slack MCP server (HTTP)
3. Test Slack tools (send_message, list_channels)

**Slack Server Tools:**
- `send_message`
- `list_channels`
- `list_users`
- `create_channel`
- `search_messages`

**Success Criteria:**
- ✅ OAuth flow works
- ✅ Can send message to Slack channel
- ✅ Can search messages

---

### Week 4: Performance & UI Polish

#### Day 16-17: Connection Pooling & Caching

**Tasks:**
1. Implement STDIO process pooling
2. Add Redis caching for tool lists
3. Implement result caching for idempotent tools
4. Performance testing

**Process Pool:**
```typescript
export class STDIOProcessPool {
  private pools: Map<string, Pool<ChildProcess>>;
  
  async acquire(serverId: string): Promise<ChildProcess> {
    const pool = this.getOrCreatePool(serverId);
    return await pool.acquire();
  }
  
  async release(serverId: string, process: ChildProcess) {
    const pool = this.pools.get(serverId);
    await pool.release(process);
  }
  
  private getOrCreatePool(serverId: string): Pool<ChildProcess> {
    if (!this.pools.has(serverId)) {
      this.pools.set(serverId, new Pool({
        min: 0,
        max: 5,
        factory: () => this.spawnProcess(serverId),
        destroyer: (proc) => proc.kill(),
        idleTimeoutMillis: 300000 // 5 minutes
      }));
    }
    return this.pools.get(serverId)!;
  }
}
```

**Caching Strategy:**
```typescript
// Cache tool lists for 1 minute
async listTools(serverId: string): Promise<Tool[]> {
  const cacheKey = `mcp:tools:${serverId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const tools = await this.fetchToolsFromServer(serverId);
  await redis.setex(cacheKey, 60, JSON.stringify(tools));
  
  return tools;
}

// Cache idempotent tool results for 5 minutes
async executeTool(serverId: string, toolName: string, args: any) {
  if (isIdempotent(toolName)) {
    const cacheKey = `mcp:result:${serverId}:${toolName}:${hash(args)}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) return JSON.parse(cached);
    
    const result = await this.callTool(serverId, toolName, args);
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    
    return result;
  }
  
  return await this.callTool(serverId, toolName, args);
}
```

**Success Criteria:**
- ✅ Tool list requests <100ms (cached)
- ✅ Read-only tool calls <200ms (cached)
- ✅ Process pool reuses connections (no spawn overhead)
- ✅ Memory usage stable under load

---

#### Day 18-19: Admin UI v2

**Tasks:**
1. Add HTTP server support to "Add Server" form
2. Build OAuth connection UI
3. Add tool usage analytics page
4. Add server health monitoring

**New UI Pages:**

**1. Add Server (HTTP):**
```tsx
<Dialog title="Add HTTP Server">
  <Input label="Server Name" />
  <Input label="Server URL" />
  
  <Select label="Authentication">
    <option>OAuth 2.0</option>
    <option>API Key</option>
    <option>Custom Header</option>
  </Select>
  
  {authType === "oauth" && (
    <Button onClick={initiateOAuth}>Connect Account</Button>
  )}
  
  {authType === "apikey" && (
    <Input label="API Key" type="password" />
  )}
</Dialog>
```

**2. Tool Analytics:**
```tsx
<AnalyticsPage>
  <MetricCard 
    title="Total Tool Calls" 
    value={stats.totalCalls} 
    change="+12% vs last week" 
  />
  
  <Chart 
    title="Tool Usage (Last 7 Days)"
    type="bar"
    data={toolUsageData}
  />
  
  <Table 
    title="Top Tools"
    columns={["Tool", "Server", "Calls", "Avg Latency", "Success Rate"]}
    data={topTools}
  />
</AnalyticsPage>
```

**3. Server Health:**
```tsx
<ServerHealthPanel serverId={serverId}>
  <StatusIndicator 
    status={server.connected ? "online" : "offline"}
    lastPing={server.lastPing}
  />
  
  <MetricList>
    <Metric label="Uptime" value={server.uptime} />
    <Metric label="Avg Latency" value={server.avgLatency} />
    <Metric label="Success Rate" value={server.successRate} />
    <Metric label="Total Calls" value={server.totalCalls} />
  </MetricList>
  
  <RecentErrors errors={server.recentErrors} />
</ServerHealthPanel>
```

**Success Criteria:**
- ✅ Can add HTTP server via OAuth
- ✅ Analytics page shows real-time data
- ✅ Server health updates every 10 seconds
- ✅ UI is responsive and intuitive

---

#### Day 20: Memory & Time Server Integration

**Tasks:**
1. Integrate Memory server (knowledge graph)
2. Integrate Time server (timezone utilities)
3. Test all 5 servers together
4. End-of-sprint demo

**Memory Server Tools:**
- `create_entities`
- `create_relations`
- `search_nodes`
- `open_nodes`

**Time Server Tools:**
- `get_current_time`
- `convert_timezone`
- `get_timestamp`

**Success Criteria:**
- ✅ 5 servers running concurrently
- ✅ Can execute tools from any server
- ✅ No performance degradation with 5 servers
- ✅ All tools work as expected

---

### Sprint 2 Deliverables

**Code:**
- ✅ HTTP transport implementation
- ✅ 5 MCP servers integrated (Filesystem, GitHub, Slack, Memory, Time)
- ✅ Connection pooling + caching
- ✅ Production-ready admin UI

**Documentation:**
- ✅ OAuth setup guide
- ✅ Server integration guide
- ✅ Admin UI user guide

**Metrics:**
- ✅ 5 servers connected
- ✅ 30+ tools available
- ✅ <100ms tool list latency
- ✅ <500ms tool execution latency (STDIO)
- ✅ <2s tool execution latency (HTTP)

---

### Sprint 2 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OAuth complexity delays | Medium | Medium | Use existing auth patterns from NextAuth |
| HTTP server latency high | Low | Medium | Implement aggressive caching |
| Redis adds complexity | Low | Low | Redis optional (fallback to memory cache) |
| GitHub rate limits | Medium | Low | Cache API responses, use conditional requests |

---

## Sprint 3: CommandMate MCP Server (Weeks 5-6)

### Goals

✅ Expose CommandMate as MCP server  
✅ Integrate with Claude Desktop  
✅ Implement server-side resources & prompts  
✅ Enable Sếp to control CommandMate from Claude

### Week 5: MCP Server Implementation

#### Day 21-22: Server Setup

**Tasks:**
1. Create `/api/mcp` endpoint (HTTP server)
2. Implement JWT authentication
3. Register basic tools (create_task, list_tasks)
4. Test with MCP Inspector

**API Route:**
```typescript
// src/pages/api/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

const server = new McpServer({
  name: "commandmate",
  version: "1.0.0"
});

// Register tools (see architecture doc for details)
server.registerTool("commandmate_create_task", ...);
server.registerTool("commandmate_list_tasks", ...);
server.registerTool("commandmate_approve_task", ...);
server.registerTool("commandmate_query_agent", ...);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const transport = new HttpServerTransport(req, res);
  await server.connect(transport);
}
```

**Success Criteria:**
- ✅ MCP server responds to `initialize`
- ✅ Can list tools via MCP Inspector
- ✅ JWT auth works (401 without token)
- ✅ Can execute `commandmate_create_task`

---

#### Day 23-24: Resources & Prompts

**Tasks:**
1. Register resources (tasks list, agent configs, knowledge)
2. Register prompts (code_review, bug_analysis)
3. Test resource retrieval
4. Test prompt execution

**Resources:**
```typescript
server.registerResource(
  "commandmate://tasks/pending",
  { name: "Pending Tasks", mimeType: "application/json" },
  async (uri, context) => {
    const user = await authenticateRequest(context.request);
    const tasks = await db.task.findMany({
      where: { userId: user.id, status: "pending" }
    });
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(tasks, null, 2)
      }]
    };
  }
);
```

**Prompts:**
```typescript
server.registerPrompt(
  "code_review",
  { 
    description: "Review code changes for quality",
    arguments: [
      { name: "pr_url", required: true },
      { name: "focus", required: false }
    ]
  },
  async ({ pr_url, focus }) => {
    return {
      messages: [{
        role: "user",
        content: `Review this PR: ${pr_url}\nFocus on: ${focus || "all"}`
      }]
    };
  }
);
```

**Success Criteria:**
- ✅ Can read `commandmate://tasks/pending`
- ✅ Can read `commandmate://agents/{id}/config`
- ✅ Prompts return correct message format
- ✅ All resources/prompts listed in Inspector

---

#### Day 25: API Key Management

**Tasks:**
1. Build API key generation UI
2. Implement key rotation
3. Add scopes/permissions
4. Test key revocation

**UI Flow:**
```
Settings → API Keys → [Generate New Key]

Dialog:
  Name: Claude Desktop Integration
  Scopes:
    ☑ Read Tasks
    ☑ Write Tasks
    ☑ Read Agents
    ☐ Write Agents
  
  [Generate Key]

Result:
  API Key: cm_sk_1234567890abcdef...
  
  ⚠️ Copy this key now. It won't be shown again.
  
  Add to Claude Desktop config:
  {
    "mcpServers": {
      "commandmate": {
        "url": "https://mission-control-sable-three.vercel.app/api/mcp",
        "headers": {
          "Authorization": "Bearer cm_sk_1234567890abcdef..."
        }
      }
    }
  }
```

**Success Criteria:**
- ✅ Can generate API key from UI
- ✅ Scopes are enforced (can't write tasks if scope missing)
- ✅ Can revoke key (subsequent requests fail)
- ✅ Key rotation works (old key grace period)

---

### Week 6: Claude Desktop Integration

#### Day 26-27: Claude Desktop Testing

**Tasks:**
1. Install Claude Desktop
2. Configure CommandMate server
3. Test all tools from Claude
4. Test resources and prompts
5. Record demo video

**Test Script:**
```
User in Claude Desktop:

1. "List my pending tasks"
   → Claude calls commandmate_list_tasks
   → Displays tasks

2. "Create a task for Kiến to refactor the auth module, high priority"
   → Claude calls commandmate_create_task
   → Task created

3. "Show me the config for agent Kiến"
   → Claude reads commandmate://agents/{kiến-id}/config
   → Displays config

4. "Review this PR: https://github.com/user/repo/pull/123"
   → Claude uses code_review prompt
   → Analyzes PR

5. "Approve task #456"
   → Claude calls commandmate_approve_task
   → Task approved
```

**Success Criteria:**
- ✅ All 5 test scenarios work
- ✅ Claude understands when to use CommandMate tools
- ✅ Responses are formatted correctly
- ✅ No authentication errors

---

#### Day 28-29: Agent Chat Integration

**Tasks:**
1. Integrate MCP tools into agent chat
2. Allow agents to call MCP tools
3. Test agent + MCP tool workflow
4. Optimize for performance

**Integration:**
```typescript
// src/server/api/routers/chat.ts
export const chatRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(z.object({ agentId: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db.agent.findUnique({ where: { id: input.agentId } });
      const mcpManager = await getMCPClientManager(ctx.db);
      
      // Get ALL tools (MCP + custom)
      const mcpTools = await mcpManager.listAllTools();
      const customTools = agent.customTools || [];
      const allTools = [...mcpTools, ...customTools];
      
      // Call LLM with tools
      const response = await callLLM({
        model: agent.model,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: input.message }
        ],
        tools: allTools
      });
      
      // Handle tool calls
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          // Check if it's an MCP tool
          const mcpTool = mcpTools.find(t => t.name === toolCall.name);
          
          if (mcpTool) {
            // Execute via MCP
            const result = await mcpManager.executeToolByName(
              toolCall.name,
              toolCall.arguments
            );
            messages.push({
              role: "tool",
              content: JSON.stringify(result.content)
            });
          } else {
            // Execute custom tool
            const result = await executeCustomTool(toolCall.name, toolCall.arguments);
            messages.push({
              role: "tool",
              content: JSON.stringify(result)
            });
          }
        }
        
        // Get final response
        const finalResponse = await callLLM({ model: agent.model, messages });
        return { message: finalResponse.content };
      }
      
      return { message: response.content };
    })
});
```

**Success Criteria:**
- ✅ Agent can call MCP tools + custom tools
- ✅ Agent chooses correct tool based on task
- ✅ Tool results are properly integrated into conversation
- ✅ Performance is acceptable (<3s total response time)

---

#### Day 30: Documentation & Polish

**Tasks:**
1. Write user documentation
2. Create setup video
3. Add error messages & help text
4. Bug fixes from testing

**Documentation:**
- "How to Connect Claude Desktop to CommandMate"
- "Using MCP Tools in Agent Chats"
- "API Key Management Guide"
- "Troubleshooting Common Issues"

**Success Criteria:**
- ✅ All docs complete
- ✅ Setup video recorded (5 minutes)
- ✅ No critical bugs remaining
- ✅ Help text in UI is clear

---

### Sprint 3 Deliverables

**Code:**
- ✅ CommandMate MCP server (HTTP)
- ✅ Tools, resources, prompts implemented
- ✅ API key management
- ✅ Agent chat integration

**Documentation:**
- ✅ User guide for Claude Desktop integration
- ✅ API reference
- ✅ Setup video

**Metrics:**
- ✅ 8 tools exposed (create_task, list_tasks, approve_task, etc.)
- ✅ 3 resources (tasks, agents, knowledge)
- ✅ 2 prompts (code_review, bug_analysis)
- ✅ Works with Claude Desktop
- ✅ Agents can use MCP tools

---

### Sprint 3 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude Desktop integration issues | Low | Medium | Test with MCP Inspector first |
| API key security concerns | Medium | High | Follow OAuth best practices, short expiry |
| Performance degradation | Low | Medium | Cache, optimize queries |
| User confusion | Medium | Low | Clear docs + videos |

---

## Sprint 4: Polish & Launch (Weeks 7-8)

### Goals

✅ Production deployment  
✅ Performance optimization  
✅ Comprehensive testing  
✅ Marketing & launch

### Week 7: Testing & Optimization

#### Day 31-32: Load Testing

**Tasks:**
1. Simulate 100 concurrent users
2. Test with 10+ servers connected
3. Identify bottlenecks
4. Optimize database queries

**Load Test Script:**
```bash
# Using k6
k6 run --vus 100 --duration 60s load-test.js

# Test scenarios:
# 1. List all tools (100 req/s)
# 2. Execute filesystem tools (50 req/s)
# 3. Execute HTTP tools (20 req/s)
# 4. Create tasks via MCP (10 req/s)
```

**Performance Targets:**
- p50 latency: <200ms
- p95 latency: <1s
- p99 latency: <3s
- Error rate: <1%

**Success Criteria:**
- ✅ All targets met
- ✅ No memory leaks
- ✅ No database connection exhaustion
- ✅ Graceful degradation under load

---

#### Day 33-34: Security Audit

**Tasks:**
1. Review auth implementation
2. Test for common vulnerabilities
3. Audit credential encryption
4. Penetration testing

**Security Checklist:**
- [ ] SQL injection protected (Prisma ORM)
- [ ] XSS protected (React escaping)
- [ ] CSRF protected (tRPC uses POST)
- [ ] Rate limiting implemented
- [ ] API keys hashed in database
- [ ] Vault credentials encrypted
- [ ] HTTPS enforced
- [ ] No secrets in logs
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints

**Success Criteria:**
- ✅ No critical vulnerabilities found
- ✅ All credentials encrypted
- ✅ Rate limiting works
- ✅ Security report documented

---

#### Day 35: Bug Fixes & Edge Cases

**Tasks:**
1. Fix bugs from user testing
2. Handle edge cases
3. Improve error messages
4. Add retry logic

**Common Edge Cases:**
- Server disconnects during tool execution
- Tool takes longer than timeout
- Invalid tool arguments
- OAuth token expires mid-request
- Database connection lost
- Out of memory (too many processes)

**Success Criteria:**
- ✅ All known bugs fixed
- ✅ Edge cases handled gracefully
- ✅ Error messages are helpful
- ✅ Automatic retries work

---

### Week 8: Launch Preparation

#### Day 36-37: Documentation Finalization

**Tasks:**
1. Complete user documentation
2. Complete developer documentation
3. Create tutorials & guides
4. Record video walkthroughs

**Documentation Structure:**
```
docs/
├── getting-started/
│   ├── overview.md
│   ├── setup.md
│   └── quick-start.md
├── user-guide/
│   ├── adding-servers.md
│   ├── using-tools.md
│   ├── claude-desktop.md
│   └── troubleshooting.md
├── developer-guide/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── creating-servers.md
│   └── contributing.md
└── videos/
    ├── setup-walkthrough.mp4
    ├── claude-integration.mp4
    └── building-custom-server.mp4
```

**Success Criteria:**
- ✅ All docs complete
- ✅ 3+ video tutorials
- ✅ API reference auto-generated
- ✅ Examples for all features

---

#### Day 38: Deployment

**Tasks:**
1. Deploy to production (Vercel)
2. Configure environment variables
3. Run database migrations
4. Enable monitoring & alerts

**Deployment Checklist:**
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Redis configured
- [ ] Sentry error tracking enabled
- [ ] Posthog analytics configured
- [ ] Uptime monitoring (BetterUptime)
- [ ] Backup strategy verified

**Rollout Plan:**
1. Deploy to staging
2. Test all features in staging
3. Deploy to production (Friday evening)
4. Monitor for 24 hours
5. Enable for beta users
6. Full rollout Monday

**Success Criteria:**
- ✅ Zero-downtime deployment
- ✅ All features working in prod
- ✅ Monitoring active
- ✅ No critical errors

---

#### Day 39-40: Launch & Marketing

**Tasks:**
1. Publish blog post
2. Share on social media
3. Reach out to early adopters
4. Monitor feedback

**Blog Post Outline:**
```markdown
# CommandMate + MCP: 100 AI Tools Without Writing Code

## The Problem
Integrating AI agents with external tools is time-consuming...

## The Solution
Model Context Protocol (MCP) + CommandMate...

## How It Works
[Architecture diagram]
[Demo video]

## Get Started
[Setup guide link]

## What's Next
Tool marketplace, custom servers, advanced workflows...
```

**Launch Channels:**
- Twitter/X: Thread with demo
- ProductHunt: Submit product
- Reddit: r/LangChain, r/LocalLLaMA
- Discord: AI developer communities
- Email: Existing CommandMate users

**Success Criteria:**
- ✅ Blog post published
- ✅ 500+ impressions on launch day
- ✅ 10+ new users try MCP feature
- ✅ Positive feedback received

---

### Sprint 4 Deliverables

**Code:**
- ✅ Production-ready MCP integration
- ✅ All bugs fixed
- ✅ Performance optimized

**Documentation:**
- ✅ Complete user guide
- ✅ Complete developer guide
- ✅ 3+ video tutorials

**Launch:**
- ✅ Production deployment
- ✅ Blog post published
- ✅ Marketing campaign launched

**Metrics:**
- ✅ 10+ MCP servers integrated
- ✅ 50+ tools available
- ✅ <200ms p50 latency
- ✅ >99% uptime
- ✅ 0 critical bugs

---

## Success Metrics Summary

### Technical Metrics

| Metric | Week 2 Target | Week 4 Target | Week 6 Target | Week 8 Target |
|--------|--------------|--------------|--------------|--------------|
| Servers Connected | 1 | 5 | 5 | 10+ |
| Tools Available | 4 | 30+ | 40+ | 50+ |
| Avg Latency (p50) | <500ms | <200ms | <200ms | <200ms |
| Success Rate | >95% | >98% | >99% | >99% |
| Test Coverage | 80% | 90% | 95% | 95% |

### Business Metrics

| Metric | Week 8 Target |
|--------|--------------|
| Beta Users | 10+ |
| Tool Calls/Day | 100+ |
| Blog Post Views | 500+ |
| Social Media Reach | 1000+ |
| GitHub Stars | 50+ |

---

## Risk Management

### High-Risk Items

1. **Vercel Timeout Limits**
   - **Risk:** STDIO processes might exceed 60s timeout
   - **Mitigation:** Use connection pooling, background jobs
   - **Fallback:** Deploy MCP manager to Railway

2. **OAuth Complexity**
   - **Risk:** OAuth flows might be buggy
   - **Mitigation:** Use NextAuth patterns, extensive testing
   - **Fallback:** Support API key auth first

3. **Performance Degradation**
   - **Risk:** Too many servers slow down system
   - **Mitigation:** Aggressive caching, lazy loading
   - **Fallback:** Limit to 10 servers in MVP

### Medium-Risk Items

1. **User Adoption**
   - **Risk:** Users don't understand MCP value
   - **Mitigation:** Clear docs, videos, examples
   - **Fallback:** Offer 1-on-1 onboarding calls

2. **Server Quality**
   - **Risk:** Community servers are buggy
   - **Mitigation:** Curate approved servers only
   - **Fallback:** Build more official servers

---

## Resource Allocation

### Time Breakdown

- **Development:** 80% (32 days × 8 hours = 256 hours)
- **Testing:** 10% (4 days × 8 hours = 32 hours)
- **Documentation:** 5% (2 days × 8 hours = 16 hours)
- **Marketing:** 5% (2 days × 8 hours = 16 hours)

**Total:** 320 hours (8 weeks × 5 days × 8 hours)

### Cost Breakdown

- **Development:** $0 (internal team)
- **OpenAI API:** ~$50 (testing + production)
- **Vercel Pro:** $0 (existing plan)
- **Supabase:** $0 (existing plan)
- **Redis:** $15 (Upstash Pro)

**Total:** ~$65

---

## Communication Plan

### Daily Standups (Async)

**Format:**
```
Yesterday: [What was completed]
Today: [What will be worked on]
Blockers: [Any issues]
```

**Channel:** Telegram group

### Weekly Reviews

**Schedule:** Every Friday 5 PM
**Attendees:** Sếp, Thép ⚙️, Minh 📋
**Agenda:**
1. Sprint progress review
2. Demo completed features
3. Risk assessment
4. Next week planning

### Sprint Demos

**Schedule:** End of each sprint (Day 10, 20, 30, 40)
**Format:** 30-minute video demo
**Audience:** Sếp + stakeholders

---

## Conclusion

This 8-week roadmap provides a **realistic, actionable plan** to integrate MCP into CommandMate with:

✅ Clear deliverables each week  
✅ Specific success criteria  
✅ Risk mitigation strategies  
✅ Realistic resource allocation

**Next Steps:**
1. Get Sếp approval on roadmap
2. Schedule Sprint 1 kickoff
3. Assign Thép ⚙️ to Week 1 tasks
4. Begin development Monday (Feb 25)

**Go/No-Go Decision Points:**
- End of Week 2: Is MCP working in Next.js?
- End of Week 4: Are 5 servers performing well?
- End of Week 6: Does Claude Desktop integration work?
- End of Week 8: Ready for production launch?

---

**Roadmap Status:** ✅ COMPLETE - Ready for execution

**Author:** Minh 📋  
**Approved by:** [Pending Sếp signature]  
**Start Date:** February 25, 2026  
**Target Launch:** April 20, 2026
