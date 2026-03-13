# CommandMate MCP Architecture Proposal
**Phase 3: Model Context Protocol Integration**  
**Author:** Minh 📋 (Business Analyst / Architect)  
**Date:** February 24, 2026  
**Version:** 1.0

---

## Executive Summary

This document outlines the technical architecture for integrating Model Context Protocol (MCP) into CommandMate, transforming it into **both an MCP client** (consuming 100+ tools) and **an MCP server** (exposing tasks/agents/knowledge to AI assistants like Claude Desktop).

**Strategic Goals:**
1. Enable agents to access 100+ external tools without custom integrations
2. Allow Sếp to control CommandMate from Claude Desktop via MCP
3. Position CommandMate as first MCP-native agent orchestration platform
4. Ship MVP in 8 weeks with ~$65 budget

**Key Design Decisions:**
- MCP client runs in Next.js API routes (no separate service needed)
- Connection pooling for STDIO servers (reuse child processes)
- Supabase for server configs + credential vault
- HTTP transport for production SaaS servers
- Tool marketplace as Phase 4 (post-MVP)

---

## 1. High-Level Architecture

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CommandMate Platform                      │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (Vercel)                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ Agent Chat  │  │ Task Manager │  │ MCP Admin UI │ │  │
│  │  └─────────────┘  └──────────────┘  └──────────────┘ │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │ tRPC                             │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │           Next.js API Routes (Backend)                 │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │         MCP Client Manager (NEW)                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │  │
│  │  │  │ Client 1 │  │ Client 2 │  │ Client N │       │ │  │
│  │  │  │(Filesys) │  │ (GitHub) │  │ (Slack)  │       │ │  │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘       │ │  │
│  │  └───────┼─────────────┼─────────────┼──────────────┘ │  │
│  │  ┌───────▼─────────────▼─────────────▼──────────────┐ │  │
│  │  │         MCP Server (CommandMate API)              │ │  │
│  │  │  Expose: tasks, agents, knowledge                 │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │         Existing tRPC Routers                      │ │  │
│  │  │  (tasks, agents, knowledge, auth)                 │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │              Supabase (PostgreSQL)                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Tables: tasks, agents, mcp_servers (NEW),       │  │  │
│  │  │         mcp_tool_calls (NEW), knowledge         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Vault: MCP server credentials (encrypted)       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
       │                           │                     │
       │ STDIO                     │ HTTP/SSE            │ HTTP
       ▼                           ▼                     ▼
┌──────────────┐          ┌──────────────┐      ┌──────────────┐
│ Local MCP    │          │ Remote MCP   │      │ Claude       │
│ Servers      │          │ Servers      │      │ Desktop      │
│ (Filesystem, │          │ (GitHub,     │      │ (connects to │
│  PostgreSQL) │          │  Slack SaaS) │      │  CM server)  │
└──────────────┘          └──────────────┘      └──────────────┘
```

### 1.2 Data Flow Example

**User asks agent: "Read the README file and create a task"**

```
1. User → Next.js UI: "Read README and create task"
2. UI → API Route: POST /api/v1/agents/chat
3. Chat Handler → LLM: Prompt + available tools from MCP
4. LLM → Chat Handler: [tool_use: read_file(path="README.md")]
5. Chat Handler → MCP Client Manager: Execute tool
6. MCP Client Manager → Filesystem Server (STDIO): read_file
7. Filesystem Server → MCP Client Manager: File content
8. MCP Client Manager → Chat Handler: Result
9. Chat Handler → LLM: "Here's the README: ..."
10. LLM → Chat Handler: [tool_use: commandmate_create_task(...)]
11. Chat Handler → tRPC: createTask mutation
12. tRPC → Supabase: INSERT INTO tasks
13. Supabase → tRPC: Task created
14. tRPC → Chat Handler: Task ID
15. Chat Handler → UI: "Task created: #123"
```

---

## 2. CommandMate as MCP Client

### 2.1 Architecture

**Location:** Next.js API Routes (`/src/server/mcp/client/`)

**Components:**

```typescript
// src/server/mcp/client/manager.ts
export class MCPClientManager {
  private clients: Map<string, MCPClientWrapper> = new Map();
  private configs: MCPServerConfig[];
  
  constructor(private db: PrismaClient) {}
  
  async initialize() {
    // Load server configs from database
    this.configs = await this.db.mcpServer.findMany({
      where: { enabled: true }
    });
    
    // Pre-connect to high-priority servers
    for (const config of this.configs.filter(c => c.autoConnect)) {
      await this.connectServer(config.id);
    }
  }
  
  async connectServer(serverId: string): Promise<void> {
    const config = this.configs.find(c => c.id === serverId);
    if (!config) throw new Error(`Server ${serverId} not found`);
    
    const transport = this.createTransport(config);
    const client = new MCPClientWrapper(config, transport);
    await client.connect();
    
    this.clients.set(serverId, client);
  }
  
  async executeTool(serverId: string, toolName: string, args: any) {
    const client = await this.getOrConnectClient(serverId);
    return await client.callTool(toolName, args);
  }
  
  async listAllTools(): Promise<Tool[]> {
    const tools = [];
    for (const [serverId, client] of this.clients) {
      const serverTools = await client.listTools();
      tools.push(...serverTools.map(t => ({...t, serverId})));
    }
    return tools;
  }
  
  private createTransport(config: MCPServerConfig): Transport {
    if (config.transport === "stdio") {
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: this.decryptEnv(config.encryptedEnv)
      });
    } else {
      return new HttpClientTransport({
        url: config.url!,
        headers: {
          "Authorization": `Bearer ${this.decryptToken(config.encryptedToken!)}`
        }
      });
    }
  }
  
  private async getOrConnectClient(serverId: string): Promise<MCPClientWrapper> {
    if (!this.clients.has(serverId)) {
      await this.connectServer(serverId);
    }
    return this.clients.get(serverId)!;
  }
}

// src/server/mcp/client/wrapper.ts
export class MCPClientWrapper {
  private client: Client;
  private toolCache: Tool[] | null = null;
  private lastToolRefresh: number = 0;
  
  constructor(
    private config: MCPServerConfig,
    private transport: Transport
  ) {
    this.client = new Client({
      name: "commandmate-client",
      version: "1.0.0"
    });
  }
  
  async connect() {
    await this.client.connect(this.transport);
    
    // Subscribe to tool list changes
    this.client.on("tools/list_changed", async () => {
      this.toolCache = null; // Invalidate cache
      await this.refreshTools();
    });
  }
  
  async listTools(): Promise<Tool[]> {
    if (this.toolCache && Date.now() - this.lastToolRefresh < 60000) {
      return this.toolCache; // Cache for 1 minute
    }
    
    return await this.refreshTools();
  }
  
  private async refreshTools(): Promise<Tool[]> {
    const response = await this.client.listTools();
    this.toolCache = response.tools;
    this.lastToolRefresh = Date.now();
    return this.toolCache;
  }
  
  async callTool(name: string, args: any): Promise<CallToolResult> {
    const result = await this.client.callTool({ name, arguments: args });
    
    // Log tool call to database
    await db.mcpToolCall.create({
      data: {
        serverId: this.config.id,
        toolName: name,
        arguments: args,
        result: result.content,
        duration: Date.now() - startTime,
        success: true
      }
    });
    
    return result;
  }
}
```

### 2.2 Database Schema

```typescript
// prisma/schema.prisma

model MCP_Server {
  id              String   @id @default(cuid())
  name            String   @unique
  description     String?
  transport       String   // "stdio" | "http"
  
  // STDIO config
  command         String?  // "node" | "python" | "npx"
  args            String[] // ["server.js"] or ["-y", "@modelcontextprotocol/server-github"]
  encryptedEnv    Json?    // {GITHUB_TOKEN: "encrypted_value"}
  
  // HTTP config
  url             String?  // "https://api.example.com/mcp"
  encryptedToken  String?  // OAuth token or API key
  
  enabled         Boolean  @default(true)
  autoConnect     Boolean  @default(false) // Connect on startup?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  toolCalls       MCP_ToolCall[]
  
  @@index([enabled, autoConnect])
}

model MCP_ToolCall {
  id              String   @id @default(cuid())
  serverId        String
  server          MCP_Server @relation(fields: [serverId], references: [id], onDelete: Cascade)
  
  toolName        String
  arguments       Json
  result          Json
  duration        Int      // Milliseconds
  success         Boolean
  error           String?
  
  // Attribution
  userId          String?
  agentId         String?
  taskId          String?
  
  createdAt       DateTime @default(now())
  
  @@index([serverId, createdAt])
  @@index([toolName, createdAt])
  @@index([userId, createdAt])
}
```

### 2.3 API Endpoints

```typescript
// src/server/api/routers/mcp.ts
export const mcpRouter = createTRPCRouter({
  // List all configured servers
  listServers: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.mcpServer.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          transport: true,
          enabled: true,
          _count: { select: { toolCalls: true } }
        }
      });
    }),
  
  // Add a new server
  addServer: protectedProcedure
    .input(z.object({
      name: z.string(),
      transport: z.enum(["stdio", "http"]),
      command: z.string().optional(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(), // Will be encrypted
      url: z.string().url().optional(),
      token: z.string().optional() // Will be encrypted
    }))
    .mutation(async ({ ctx, input }) => {
      // Encrypt sensitive data
      const encryptedEnv = input.env 
        ? await encryptVault(input.env)
        : null;
      const encryptedToken = input.token
        ? await encryptVault({ token: input.token })
        : null;
      
      return await ctx.db.mcpServer.create({
        data: {
          name: input.name,
          transport: input.transport,
          command: input.command,
          args: input.args,
          encryptedEnv,
          url: input.url,
          encryptedToken
        }
      });
    }),
  
  // List all available tools across all servers
  listTools: protectedProcedure
    .query(async ({ ctx }) => {
      const manager = await getMCPClientManager(ctx.db);
      return await manager.listAllTools();
    }),
  
  // Execute a tool
  executeTool: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      toolName: z.string(),
      arguments: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = await getMCPClientManager(ctx.db);
      
      try {
        const result = await manager.executeTool(
          input.serverId,
          input.toolName,
          input.arguments
        );
        
        return {
          success: true,
          content: result.content
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }),
  
  // Get tool call history
  getToolHistory: protectedProcedure
    .input(z.object({
      serverId: z.string().optional(),
      limit: z.number().default(50)
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.mcpToolCall.findMany({
        where: { serverId: input.serverId },
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          server: { select: { name: true } }
        }
      });
    })
});
```

### 2.4 Connection Pooling Strategy

**Problem:** Spawning a new child process for every tool call is slow (~100ms overhead).

**Solution:** Connection pooling with lazy initialization.

```typescript
export class STDIOConnectionPool {
  private pools: Map<string, ProcessPool> = new Map();
  
  async getProcess(serverId: string): Promise<ChildProcess> {
    if (!this.pools.has(serverId)) {
      this.pools.set(serverId, new ProcessPool(serverId, {
        min: 0,  // Start with 0 processes
        max: 5,  // Max 5 concurrent connections
        idleTimeout: 300000, // Kill idle after 5 minutes
      }));
    }
    
    return await this.pools.get(serverId)!.acquire();
  }
  
  async releaseProcess(serverId: string, process: ChildProcess) {
    await this.pools.get(serverId)?.release(process);
  }
}

class ProcessPool {
  private available: ChildProcess[] = [];
  private inUse: Set<ChildProcess> = new Set();
  
  async acquire(): Promise<ChildProcess> {
    if (this.available.length > 0) {
      const proc = this.available.pop()!;
      this.inUse.add(proc);
      return proc;
    }
    
    if (this.inUse.size < this.options.max) {
      const proc = await this.spawnProcess();
      this.inUse.add(proc);
      return proc;
    }
    
    // Wait for available process
    return await this.waitForAvailable();
  }
  
  async release(proc: ChildProcess) {
    this.inUse.delete(proc);
    this.available.push(proc);
    
    // Schedule cleanup if idle too long
    setTimeout(() => {
      if (this.available.includes(proc)) {
        proc.kill();
        this.available = this.available.filter(p => p !== proc);
      }
    }, this.options.idleTimeout);
  }
  
  private async spawnProcess(): Promise<ChildProcess> {
    const config = await getServerConfig(this.serverId);
    const proc = spawn(config.command, config.args, {
      env: config.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Health check
    proc.on('exit', () => this.handleProcessExit(proc));
    
    return proc;
  }
}
```

---

## 3. CommandMate as MCP Server

### 3.1 Architecture

**Location:** Next.js API Route: `/api/mcp` (HTTP transport)

**Exposed Capabilities:**
- **Resources:** tasks list, agent configs, knowledge base
- **Tools:** create_task, update_task, approve_task, query_agent
- **Prompts:** code_review, bug_analysis, architecture_design

### 3.2 Implementation

```typescript
// src/pages/api/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";

const server = new McpServer({
  name: "commandmate",
  version: "1.0.0"
});

// ==================== TOOLS ====================

server.registerTool(
  "commandmate_create_task",
  {
    description: "Create a new task in CommandMate",
    inputSchema: {
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      agentId: z.string().uuid(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      dueDate: z.string().datetime().optional()
    }
  },
  async ({ title, description, agentId, priority, dueDate }, context) => {
    // Authenticate request
    const user = await authenticateRequest(context.request);
    
    // Create task via tRPC
    const task = await createTask({
      title,
      description,
      agentId,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      userId: user.id
    });
    
    return {
      content: [{
        type: "text",
        text: `Task created successfully!\nID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}`
      }]
    };
  }
);

server.registerTool(
  "commandmate_list_tasks",
  {
    description: "List tasks with filters",
    inputSchema: {
      status: z.enum(["pending", "in_progress", "completed", "failed"]).optional(),
      agentId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(10)
    }
  },
  async ({ status, agentId, limit }, context) => {
    const user = await authenticateRequest(context.request);
    
    const tasks = await listTasks({
      where: {
        userId: user.id,
        status,
        agentId
      },
      take: limit,
      orderBy: { createdAt: "desc" }
    });
    
    const taskList = tasks.map(t => 
      `- [${t.id}] ${t.title} (${t.status}) - ${t.agent.name}`
    ).join("\n");
    
    return {
      content: [{
        type: "text",
        text: `Tasks (${tasks.length}):\n${taskList}`
      }]
    };
  }
);

server.registerTool(
  "commandmate_approve_task",
  {
    description: "Approve a task that requires human approval",
    inputSchema: {
      taskId: z.string().uuid(),
      approved: z.boolean(),
      feedback: z.string().optional()
    }
  },
  async ({ taskId, approved, feedback }, context) => {
    const user = await authenticateRequest(context.request);
    
    const task = await approveTask({
      taskId,
      approved,
      feedback,
      userId: user.id
    });
    
    return {
      content: [{
        type: "text",
        text: approved 
          ? `Task ${taskId} approved. Agent will proceed.`
          : `Task ${taskId} rejected. Feedback: ${feedback}`
      }]
    };
  }
);

// ==================== RESOURCES ====================

server.registerResource(
  "commandmate://tasks/pending",
  {
    name: "Pending Tasks",
    description: "List of all pending tasks",
    mimeType: "application/json"
  },
  async (uri, context) => {
    const user = await authenticateRequest(context.request);
    
    const tasks = await listTasks({
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

server.registerResource(
  "commandmate://agents/{id}/config",
  {
    name: "Agent Configuration",
    description: "Configuration for a specific agent",
    mimeType: "application/json"
  },
  async (uri, context) => {
    const agentId = extractIdFromUri(uri);
    const user = await authenticateRequest(context.request);
    
    const agent = await getAgent({ id: agentId, userId: user.id });
    
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          model: agent.model,
          capabilities: agent.capabilities
        }, null, 2)
      }]
    };
  }
);

// ==================== PROMPTS ====================

server.registerPrompt(
  "code_review",
  {
    description: "Review code changes for quality, security, and best practices",
    arguments: [
      {
        name: "pr_url",
        description: "GitHub PR URL",
        required: true
      },
      {
        name: "focus",
        description: "Focus area: security, performance, style, or all",
        required: false
      }
    ]
  },
  async ({ pr_url, focus }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review this pull request: ${pr_url}\n\nFocus on: ${focus || "all aspects"}\n\nProvide:\n1. Critical issues (security, bugs)\n2. Code quality suggestions\n3. Performance concerns\n4. Overall recommendation (approve/request changes)`
          }
        }
      ]
    };
  }
);

// ==================== AUTH ====================

async function authenticateRequest(request: Request): Promise<User> {
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
  
  if (!apiKey) {
    throw new Error("Missing API key");
  }
  
  // Verify JWT or API key
  const payload = await verifyJWT(apiKey);
  
  const user = await db.user.findUnique({
    where: { id: payload.sub }
  });
  
  if (!user) {
    throw new Error("Invalid API key");
  }
  
  return user;
}

// ==================== HTTP TRANSPORT ====================

export default async function handler(req: Request) {
  const transport = new HttpServerTransport(req);
  
  await server.connect(transport);
  
  return transport.response;
}
```

### 3.3 Claude Desktop Configuration

**For Sếp to control CommandMate from Claude Desktop:**

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "commandmate": {
      "url": "https://mission-control-sable-three.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_COMMANDMATE_API_KEY"
      }
    }
  }
}
```

**Usage:**
```
Sếp in Claude Desktop:
"Create a task for Kiến to build the MCP client manager, high priority, due next Friday"

Claude calls: commandmate_create_task(
  title="Build MCP client manager",
  agentId="<Kiến's UUID>",
  priority="high",
  dueDate="2026-03-01T00:00:00Z"
)

CommandMate: Task created #456
```

---

## 4. Security Model

### 4.1 Authentication & Authorization

**CommandMate MCP Server:**
- **Auth:** JWT or API key in `Authorization: Bearer <token>` header
- **Scope:** Per-user isolation (can only access own tasks/agents)
- **Rate Limit:** 100 req/min per API key (Redis-based)

**MCP Client (consuming servers):**
- **Credential Storage:** Supabase Vault (encrypted at rest)
- **Encryption:** AES-256-GCM for environment variables
- **Access Control:** Only admins can add/remove servers

### 4.2 Credential Encryption

```typescript
// src/server/lib/vault.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service role key
);

export async function encryptVault(data: Record<string, string>): Promise<string> {
  // Use Supabase Vault for encryption
  const { data: result, error } = await supabase
    .from("vault.secrets")
    .insert({
      secret: data,
      key_id: process.env.VAULT_KEY_ID
    })
    .select("id")
    .single();
  
  if (error) throw error;
  
  return result.id; // Return vault ID (stores encrypted data)
}

export async function decryptVault(vaultId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("vault.decrypted_secrets")
    .select("secret")
    .eq("id", vaultId)
    .single();
  
  if (error) throw error;
  
  return data.secret;
}
```

### 4.3 Sandboxing (Future Enhancement)

**Problem:** Untrusted MCP servers could be malicious.

**Solution (Phase 4):**
- Run STDIO servers in Docker containers
- Limit file system access
- Network isolation
- Resource limits (CPU, memory)

---

## 5. Performance Optimization

### 5.1 Latency Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| List tools | <100ms | Cache for 1 minute |
| Execute tool (STDIO) | <500ms | Connection pooling |
| Execute tool (HTTP) | <2s | Parallel requests |
| Server startup | <200ms | Lazy initialization |

### 5.2 Caching Strategy

```typescript
// src/server/mcp/cache.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export class MCPCache {
  // Cache tool list
  async getTools(serverId: string): Promise<Tool[] | null> {
    const key = `mcp:tools:${serverId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async setTools(serverId: string, tools: Tool[]) {
    const key = `mcp:tools:${serverId}`;
    await redis.setex(key, 60, JSON.stringify(tools)); // 1-minute TTL
  }
  
  // Cache tool results (idempotent tools only)
  async cacheToolResult(toolName: string, args: any, result: any) {
    if (!isIdempotent(toolName)) return;
    
    const key = `mcp:result:${toolName}:${hashArgs(args)}`;
    await redis.setex(key, 300, JSON.stringify(result)); // 5-minute TTL
  }
}

function isIdempotent(toolName: string): boolean {
  // Read-only tools are idempotent
  return toolName.startsWith("get_") || 
         toolName.startsWith("list_") ||
         toolName.startsWith("read_");
}
```

### 5.3 Parallel Tool Execution

```typescript
// Execute multiple tools in parallel
export async function executeToolBatch(
  requests: ToolRequest[]
): Promise<ToolResult[]> {
  const promises = requests.map(req => 
    mcpManager.executeT(req.serverId, req.toolName, req.arguments)
  );
  
  return await Promise.allSettled(promises);
}
```

---

## 6. Admin Dashboard UI

### 6.1 MCP Server Management Page

**Location:** `/dashboard/mcp/servers`

**Features:**
- List all configured MCP servers
- Add new server (wizard-style form)
- Edit server config
- Enable/disable server
- View connection status
- Test connection

**Wireframe:**

```
┌────────────────────────────────────────────────────────┐
│ MCP Servers                           [+ Add Server]   │
├────────────────────────────────────────────────────────┤
│                                                         │
│ ┌──────────────────────────────────────────────────┐  │
│ │ 🟢 Filesystem Server                  [Enabled] │  │
│ │    Transport: STDIO                              │  │
│ │    Command: node /servers/filesystem/index.js   │  │
│ │    Tools: 4 (read_file, write_file, ...)        │  │
│ │    Last Used: 2 minutes ago                      │  │
│ │    [Edit] [Test] [Disable]                       │  │
│ └──────────────────────────────────────────────────┘  │
│                                                         │
│ ┌──────────────────────────────────────────────────┐  │
│ │ 🟢 GitHub Server                      [Enabled] │  │
│ │    Transport: HTTP                               │  │
│ │    URL: https://api.github.com/mcp               │  │
│ │    Auth: OAuth (expires in 29 days)              │  │
│ │    Tools: 12 (create_pr, list_issues, ...)      │  │
│ │    Last Used: 1 hour ago                         │  │
│ │    [Edit] [Test] [Disable]                       │  │
│ └──────────────────────────────────────────────────┘  │
│                                                         │
│ ┌──────────────────────────────────────────────────┐  │
│ │ 🔴 Slack Server                      [Disabled]  │  │
│ │    Transport: HTTP                               │  │
│ │    Error: Invalid OAuth token                    │  │
│ │    [Edit] [Reconnect] [Enable]                   │  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 6.2 Add Server Wizard

**Step 1: Choose Transport**
```
[ ] STDIO (Local Server)
    Run a server on the same machine as CommandMate
    
[x] HTTP (Remote Server)
    Connect to a cloud-hosted MCP server
```

**Step 2: Configure (HTTP)**
```
Name: GitHub Server
Description: Access GitHub repositories, PRs, issues

Server URL: https://api.github.com/mcp

Authentication:
[x] OAuth 2.0
[ ] API Key
[ ] Custom Header

[Connect GitHub Account]
```

**Step 3: Test Connection**
```
Testing connection...
✅ Connected successfully
✅ Found 12 tools
✅ Tools: create_pr, list_issues, search_code, ...

[Finish Setup]
```

### 6.3 Tool Usage Analytics

**Location:** `/dashboard/mcp/analytics`

**Metrics:**
- Top 10 most-used tools
- Tool execution success rate
- Average latency per tool
- Total tool calls (daily/weekly/monthly)
- Tools by server

**Chart:**
```
Tool Usage (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
read_file           ████████████████ 156
create_task         ███████████ 89
list_issues         ████████ 67
send_slack_message  ██████ 45
create_pr           ████ 34
```

---

## 7. Integration Points

### 7.1 Agent Chat Integration

**Current Flow:**
```
User → Chat UI → tRPC → LLM → Response
```

**New Flow with MCP:**
```
User → Chat UI → tRPC → LLM + MCP Tools → Tool Execution → LLM → Response
```

**Implementation:**

```typescript
// src/server/api/routers/chat.ts
export const chatRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      message: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db.agent.findUnique({
        where: { id: input.agentId }
      });
      
      // Get available MCP tools
      const mcpManager = await getMCPClientManager(ctx.db);
      const tools = await mcpManager.listAllTools();
      
      // Convert MCP tools to LLM tool format
      const llmTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }));
      
      // Call LLM with tools
      const response = await callLLM({
        model: agent.model,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: input.message }
        ],
        tools: llmTools
      });
      
      // If LLM wants to use a tool
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          const result = await mcpManager.executeToolByName(
            toolCall.name,
            toolCall.arguments
          );
          
          // Send result back to LLM
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result.content)
          });
        }
        
        // Get final response from LLM
        const finalResponse = await callLLM({
          model: agent.model,
          messages
        });
        
        return { message: finalResponse.content };
      }
      
      return { message: response.content };
    })
});
```

### 7.2 Task Execution Integration

**Scenario:** Agent executes task that requires file operations.

```typescript
// src/server/api/routers/tasks.ts
async function executeTask(task: Task, agent: Agent) {
  const mcpManager = await getMCPClientManager(db);
  
  // Agent code can call MCP tools
  const agentContext = {
    tools: {
      readFile: async (path: string) => {
        const result = await mcpManager.executeToolByName("read_file", { path });
        return result.content[0].text;
      },
      writeFile: async (path: string, content: string) => {
        await mcpManager.executeToolByName("write_file", { path, content });
      }
    }
  };
  
  // Execute agent code with MCP tools
  const result = await runAgentCode(agent.code, agentContext);
  
  return result;
}
```

---

## 8. Deployment Strategy

### 8.1 Environment Variables

```bash
# .env.production

# Existing vars
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
OPENAI_API_KEY="..."

# New MCP vars
MCP_ENABLED=true
MCP_MAX_CONNECTIONS=10  # Max concurrent STDIO processes
MCP_TOOL_TIMEOUT=30000  # 30 seconds
VAULT_KEY_ID="..."      # Supabase Vault encryption key
REDIS_URL="redis://..."  # For caching
```

### 8.2 Vercel Configuration

**Limitations:**
- Vercel serverless functions have 10s timeout (Hobby) or 60s (Pro)
- No persistent processes (STDIO servers must respawn)
- 50MB function size limit

**Solutions:**
- Use Vercel Pro for 60s timeout
- Implement aggressive caching
- Move long-running tools to background jobs (Vercel Cron or Inngest)

**vercel.json:**
```json
{
  "functions": {
    "src/pages/api/mcp.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "MCP_ENABLED": "true"
  }
}
```

### 8.3 Migration Plan

**Week 1:**
1. Add `mcp_servers` + `mcp_tool_calls` tables
2. Implement `MCPClientManager` (STDIO only)
3. Deploy to staging

**Week 2:**
1. Add HTTP transport support
2. Build admin UI (server management)
3. Test with 3 servers (filesystem, GitHub, Slack)

**Week 3-4:**
1. Integrate with agent chat
2. Build CommandMate MCP server
3. Load testing (100 concurrent tool calls)

**Week 5-6:**
1. Production deployment
2. Monitor performance
3. Fix bugs

**Week 7-8:**
1. Documentation
2. User onboarding
3. Marketing

---

## 9. Monitoring & Observability

### 9.1 Metrics to Track

**Server Health:**
- MCP server uptime (%)
- Connection failures (count)
- Average reconnection time

**Tool Performance:**
- Tool execution latency (p50, p95, p99)
- Tool success rate (%)
- Tool timeout rate (%)

**Usage:**
- Total tool calls (daily)
- Unique tools used
- Top users by tool calls

### 9.2 Logging

```typescript
// src/server/lib/logger.ts
export const logger = {
  mcpToolCall: (data: {
    serverId: string;
    toolName: string;
    duration: number;
    success: boolean;
    error?: string;
  }) => {
    console.log({
      type: "mcp.tool_call",
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Send to analytics
    posthog.capture("mcp_tool_call", data);
  },
  
  mcpServerError: (data: {
    serverId: string;
    error: string;
  }) => {
    console.error({
      type: "mcp.server_error",
      ...data
    });
    
    // Alert admins
    sendAlert(`MCP server ${data.serverId} error: ${data.error}`);
  }
};
```

### 9.3 Alerts

**Critical Alerts:**
- MCP server down for >5 minutes
- Tool success rate drops below 80%
- Tool latency >10s (p95)

**Warning Alerts:**
- Server connection failures spike
- Unusual tool usage patterns
- Credential expiration in <7 days

---

## 10. Future Enhancements (Phase 4+)

### 10.1 Tool Marketplace

**Vision:** One-click installation of 100+ MCP servers.

**Features:**
- Browse servers by category (productivity, dev tools, data sources)
- Read reviews & ratings
- Install with wizard
- Auto-configure OAuth

**UI Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ MCP Tool Marketplace                  [Search: GitHub] │
├────────────────────────────────────────────────────────┤
│                                                         │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│ │  GitHub    │  │  Slack     │  │  Notion    │       │
│ │  ⭐⭐⭐⭐⭐  │  │  ⭐⭐⭐⭐⭐  │  │  ⭐⭐⭐⭐☆  │       │
│ │  12 tools  │  │  8 tools   │  │  6 tools   │       │
│ │  [Install] │  │  [Install] │  │  [Install] │       │
│ └────────────┘  └────────────┘  └────────────┘       │
│                                                         │
│ Popular Tools: Code Review, Web Search, Database, ... │
└────────────────────────────────────────────────────────┘
```

### 10.2 Tool Chaining

**Vision:** Chain multiple tools together.

**Example:**
```
Workflow: "Blog Post to Social Media"
1. read_file("blog.md")
2. summarize_text(content)
3. generate_image(summary)
4. post_twitter(summary, image)
5. post_linkedin(summary, image)
```

**Implementation:**
```typescript
type ToolChain = {
  name: string;
  steps: {
    toolName: string;
    arguments: Record<string, any> | { $ref: string }; // $ref = output from previous step
  }[];
};

async function executeChain(chain: ToolChain) {
  const results = [];
  
  for (const step of chain.steps) {
    const args = resolveReferences(step.arguments, results);
    const result = await mcpManager.executeToolByName(step.toolName, args);
    results.push(result);
  }
  
  return results;
}
```

### 10.3 Custom MCP Servers

**Vision:** Users create custom servers via no-code UI.

**Example:**
```
Server Name: My Company CRM
Tools:
  - get_customer(id)
    → SELECT * FROM customers WHERE id = ?
  - create_order(customer_id, items)
    → INSERT INTO orders ...
```

**Implementation:**
- SQL query builder
- REST API wrapper
- JavaScript function editor

---

## 11. Success Metrics

### 11.1 Technical Metrics

**Week 4 Targets:**
- ✅ 5 MCP servers connected
- ✅ <500ms average tool latency (STDIO)
- ✅ <2s average tool latency (HTTP)
- ✅ >95% tool execution success rate

**Week 8 Targets:**
- ✅ 10+ MCP servers connected
- ✅ CommandMate MCP server live (Claude Desktop integration)
- ✅ 100+ tool calls/day
- ✅ Admin dashboard complete

### 11.2 Business Metrics

**User Adoption:**
- 10+ users connect at least 1 MCP server
- 50+ tool calls from agents in first week
- 0 critical bugs reported

**Competitive Positioning:**
- First MCP-native agent platform launched
- Blog post: "CommandMate + MCP: 100 Tools Without Code"
- Demo video showing Claude Desktop → CommandMate

---

## 12. Risk Mitigation

### 12.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| v2 SDK breaking changes | High | Medium | Stay on v1.x until v2 stable |
| Vercel timeout limits | Medium | Low | Use Pro plan + background jobs |
| STDIO process leaks | Medium | Medium | Implement health checks + auto-restart |
| Security vulnerability | High | Low | Regular security audits + sandboxing |

### 12.2 Contingency Plans

**If Week 4 prototype fails:**
- Simplify to STDIO only (skip HTTP)
- Connect 3 servers instead of 5
- Extend timeline to 10 weeks

**If Vercel limits block STDIO:**
- Deploy MCP client manager to Railway/Fly.io
- Use Vercel for frontend only
- API calls from Vercel → Railway (internal network)

---

## Conclusion

This architecture enables CommandMate to:
1. **As MCP Client:** Access 100+ tools via STDIO/HTTP transports
2. **As MCP Server:** Expose tasks/agents/knowledge to Claude Desktop
3. **Position:** First MCP-native agent orchestration platform

**Key Strengths:**
- Leverages existing Next.js + Supabase stack
- No new infrastructure required (runs on Vercel)
- Clear separation of concerns (client manager, server, API routes)
- Scales with connection pooling + caching

**Next Steps:**
1. Get Sếp approval on architecture
2. Spawn Thép ⚙️ (Opus) to build Week 1 prototype
3. Test assumptions with real MCP servers
4. Iterate based on feedback

**Timeline:** 8 weeks from approval to production deployment.

---

**Document Status:** ✅ COMPLETE - Ready for technical implementation

**Author:** Minh 📋  
**Reviewers:** Sếp (Business), Thép ⚙️ (Technical)  
**Version:** 1.0 (Final)
