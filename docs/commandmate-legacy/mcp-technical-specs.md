# MCP Technical Specifications
**CommandMate Phase 3: Implementation Guide**  
**Author:** Minh 📋 (Technical BA)  
**Date:** February 24, 2026  
**Version:** 1.0

---

## 1. NPM Dependencies

### 1.1 Core MCP Packages

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "zod": "^4.0.0"
  }
}
```

**Version Strategy:**
- Use v1.x (stable) until v2.0 releases (Q1 2026)
- Pin exact versions in `package-lock.json`
- Monitor changelog for security updates

**Peer Dependencies:**
- `zod` v4.x (required for schema validation)
- TypeScript 5.x+ (recommended)

### 1.2 Additional Dependencies

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "generic-pool": "^3.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/generic-pool": "^3.9.0"
  }
}
```

**Purpose:**
- `ioredis`: Redis client for caching
- `generic-pool`: Connection pooling for STDIO processes

---

## 2. TypeScript Interfaces

### 2.1 MCP Server Configuration

```typescript
// src/types/mcp.ts

/**
 * MCP server configuration stored in database
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: "stdio" | "http";
  
  // STDIO-specific config
  command?: string; // e.g., "node", "python", "npx"
  args?: string[]; // e.g., ["server.js"] or ["-y", "@modelcontextprotocol/server-github"]
  encryptedEnv?: string; // Vault ID for encrypted environment variables
  
  // HTTP-specific config
  url?: string; // e.g., "https://api.github.com/mcp"
  encryptedToken?: string; // Vault ID for OAuth token or API key
  
  // Common config
  enabled: boolean;
  autoConnect: boolean; // Connect on startup?
  maxConnections?: number; // For connection pooling (default: 5)
  timeout?: number; // Tool execution timeout in ms (default: 30000)
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastConnectedAt?: Date;
  lastError?: string;
}

/**
 * Tool definition from MCP server
 */
export interface MCPTool {
  serverId: string; // Which server provides this tool
  name: string; // e.g., "read_file"
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
  userId?: string; // For audit logging
  agentId?: string;
  taskId?: string;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  content?: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string; // Base64 for images
    uri?: string; // For resources
    mimeType?: string;
  }>;
  error?: string;
  duration: number; // Milliseconds
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  uri: string; // e.g., "commandmate://tasks/pending"
  name: string;
  description?: string;
  mimeType: string; // e.g., "application/json", "text/plain"
}

/**
 * MCP prompt template
 */
export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}
```

### 2.2 Client Manager Interfaces

```typescript
// src/server/mcp/types.ts

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Wrapper around MCP client for a single server
 */
export interface MCPClientWrapper {
  config: MCPServerConfig;
  client: Client;
  transport: Transport;
  connected: boolean;
  toolCache: MCPTool[] | null;
  lastToolRefresh: number;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: any): Promise<ToolExecutionResult>;
  isHealthy(): Promise<boolean>;
}

/**
 * Pool of client connections
 */
export interface ClientPool {
  acquire(serverId: string): Promise<MCPClientWrapper>;
  release(serverId: string, client: MCPClientWrapper): Promise<void>;
  destroy(serverId: string): Promise<void>;
  size(serverId: string): number;
}

/**
 * Cache interface for tool metadata
 */
export interface MCPCache {
  getTools(serverId: string): Promise<MCPTool[] | null>;
  setTools(serverId: string, tools: MCPTool[], ttl?: number): Promise<void>;
  invalidateTools(serverId: string): Promise<void>;
  
  getToolResult(serverId: string, toolName: string, args: any): Promise<ToolExecutionResult | null>;
  setToolResult(serverId: string, toolName: string, args: any, result: ToolExecutionResult, ttl?: number): Promise<void>;
}
```

---

## 3. Database Migrations

### 3.1 Prisma Schema Additions

```prisma
// prisma/schema.prisma

model MCP_Server {
  id              String   @id @default(cuid())
  name            String   @unique
  description     String?
  transport       String   // "stdio" | "http"
  
  // STDIO config
  command         String?
  args            String[] @default([])
  encryptedEnv    String?  // Vault ID
  
  // HTTP config
  url             String?
  encryptedToken  String?  // Vault ID
  
  // Common config
  enabled         Boolean  @default(true)
  autoConnect     Boolean  @default(false)
  maxConnections  Int      @default(5)
  timeout         Int      @default(30000)
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastConnectedAt DateTime?
  lastError       String?
  
  // Relations
  toolCalls       MCP_ToolCall[]
  
  @@index([enabled, autoConnect])
  @@index([transport])
}

model MCP_ToolCall {
  id              String   @id @default(cuid())
  serverId        String
  server          MCP_Server @relation(fields: [serverId], references: [id], onDelete: Cascade)
  
  toolName        String
  arguments       Json
  result          Json?
  duration        Int      // Milliseconds
  success         Boolean
  error           String?
  
  // Attribution (optional)
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  agentId         String?
  agent           Agent?   @relation(fields: [agentId], references: [id], onDelete: SetNull)
  taskId          String?
  task            Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  
  createdAt       DateTime @default(now())
  
  @@index([serverId, createdAt])
  @@index([toolName, createdAt])
  @@index([userId, createdAt])
  @@index([success, createdAt])
}

// Add relations to existing models
model User {
  // ... existing fields ...
  mcpToolCalls    MCP_ToolCall[]
}

model Agent {
  // ... existing fields ...
  mcpToolCalls    MCP_ToolCall[]
}

model Task {
  // ... existing fields ...
  mcpToolCalls    MCP_ToolCall[]
}
```

### 3.2 Migration SQL

```sql
-- Migration: 001_add_mcp_tables.sql

-- Create MCP_Server table
CREATE TABLE "MCP_Server" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "transport" TEXT NOT NULL,
  "command" TEXT,
  "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "encryptedEnv" TEXT,
  "url" TEXT,
  "encryptedToken" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "autoConnect" BOOLEAN NOT NULL DEFAULT false,
  "maxConnections" INTEGER NOT NULL DEFAULT 5,
  "timeout" INTEGER NOT NULL DEFAULT 30000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastConnectedAt" TIMESTAMP(3),
  "lastError" TEXT
);

-- Create indexes for MCP_Server
CREATE INDEX "MCP_Server_enabled_autoConnect_idx" ON "MCP_Server"("enabled", "autoConnect");
CREATE INDEX "MCP_Server_transport_idx" ON "MCP_Server"("transport");

-- Create MCP_ToolCall table
CREATE TABLE "MCP_ToolCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "arguments" JSONB NOT NULL,
  "result" JSONB,
  "duration" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL,
  "error" TEXT,
  "userId" TEXT,
  "agentId" TEXT,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MCP_ToolCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MCP_Server"("id") ON DELETE CASCADE,
  CONSTRAINT "MCP_ToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "MCP_ToolCall_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL,
  CONSTRAINT "MCP_ToolCall_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL
);

-- Create indexes for MCP_ToolCall
CREATE INDEX "MCP_ToolCall_serverId_createdAt_idx" ON "MCP_ToolCall"("serverId", "createdAt");
CREATE INDEX "MCP_ToolCall_toolName_createdAt_idx" ON "MCP_ToolCall"("toolName", "createdAt");
CREATE INDEX "MCP_ToolCall_userId_createdAt_idx" ON "MCP_ToolCall"("userId", "createdAt");
CREATE INDEX "MCP_ToolCall_success_createdAt_idx" ON "MCP_ToolCall"("success", "createdAt");
```

### 3.3 Seed Data (Development)

```typescript
// prisma/seed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedMCPServers() {
  // Filesystem server (STDIO)
  await prisma.mCP_Server.create({
    data: {
      id: "fs-local",
      name: "Filesystem",
      description: "Local file operations",
      transport: "stdio",
      command: "node",
      args: ["/absolute/path/to/filesystem/server/build/index.js"],
      enabled: true,
      autoConnect: true
    }
  });
  
  // Time server (STDIO)
  await prisma.mCP_Server.create({
    data: {
      id: "time-server",
      name: "Time",
      description: "Timezone and time utilities",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-time"],
      enabled: true,
      autoConnect: false
    }
  });
  
  // Example HTTP server (disabled by default)
  await prisma.mCP_Server.create({
    data: {
      id: "github-server",
      name: "GitHub",
      description: "GitHub API integration",
      transport: "http",
      url: "https://api.github.com/mcp",
      enabled: false, // Requires OAuth setup
      autoConnect: false
    }
  });
}

async function main() {
  await seedMCPServers();
  console.log("✅ MCP servers seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 4. Environment Variables

### 4.1 Required Variables

```bash
# .env.production

# ==================== MCP CONFIGURATION ====================

# Enable/disable MCP feature
MCP_ENABLED=true

# Max concurrent STDIO processes per server
MCP_MAX_CONNECTIONS=5

# Default tool execution timeout (ms)
MCP_TOOL_TIMEOUT=30000

# Connection pool idle timeout (ms)
MCP_POOL_IDLE_TIMEOUT=300000

# Supabase Vault encryption key ID
VAULT_KEY_ID=vault_key_abc123

# Redis URL for caching (optional, fallback to in-memory)
REDIS_URL=redis://default:password@redis.upstash.io:6379

# ==================== EXISTING VARS ====================

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...

# NextAuth
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://mission-control.vercel.app

# OpenAI
OPENAI_API_KEY=sk-xxx
```

### 4.2 Optional Variables

```bash
# MCP debug mode (logs all JSON-RPC messages)
MCP_DEBUG=false

# MCP cache TTL (seconds)
MCP_CACHE_TOOLS_TTL=60
MCP_CACHE_RESULTS_TTL=300

# Rate limiting
MCP_RATE_LIMIT_PER_MINUTE=100

# Feature flags
ENABLE_MCP_MARKETPLACE=false
ENABLE_MCP_CUSTOM_SERVERS=false
```

---

## 5. Development Setup Guide

### 5.1 Prerequisites

- Node.js 18+ (recommended: 20+)
- pnpm or npm
- PostgreSQL 14+
- Redis (optional, for caching)
- Git

### 5.2 Local Setup Steps

```bash
# 1. Clone repository
git clone https://github.com/YourOrg/commandmate.git
cd commandmate

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Run database migrations
pnpm prisma migrate dev
pnpm prisma db seed

# 5. Clone MCP reference servers (for testing)
mkdir -p mcp-servers
cd mcp-servers

# Filesystem server
git clone https://github.com/modelcontextprotocol/servers.git
cd servers/src/filesystem
npm install
npm run build
cd ../../../

# 6. Update .env.local with absolute paths
# MCP_FILESYSTEM_SERVER_PATH=/absolute/path/to/mcp-servers/servers/src/filesystem/build/index.js

# 7. Start development server
pnpm dev

# 8. Verify MCP integration
# - Navigate to http://localhost:3000/dashboard/mcp/servers
# - Add filesystem server
# - Test connection
```

### 5.3 Testing MCP Servers

```bash
# Option 1: Use MCP Inspector (recommended)
npx @modelcontextprotocol/inspector

# Option 2: Manual testing with curl
curl -X POST http://localhost:3000/api/trpc/mcp.listTools \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{}'

# Option 3: Integration tests
pnpm test:mcp
```

### 5.4 Common Issues

**Issue 1: "Cannot spawn process"**
```
Error: spawn ENOENT
```
**Solution:** Verify `command` in server config is in PATH.
```bash
which node  # Should output /usr/local/bin/node or similar
which python3  # For Python servers
```

**Issue 2: "Connection timeout"**
```
Error: Timeout after 30000ms
```
**Solution:** Increase `MCP_TOOL_TIMEOUT` or check server logs.

**Issue 3: "Vault encryption failed"**
```
Error: Vault key not found
```
**Solution:** Ensure `VAULT_KEY_ID` is set and valid in Supabase.

---

## 6. API Endpoint Documentation

### 6.1 tRPC Endpoints

#### `mcp.listServers`

**Description:** List all configured MCP servers

**Input:** None

**Output:**
```typescript
{
  servers: Array<{
    id: string;
    name: string;
    description?: string;
    transport: "stdio" | "http";
    enabled: boolean;
    lastConnectedAt?: string;
    toolCount?: number;
  }>
}
```

**Example:**
```typescript
const servers = await trpc.mcp.listServers.query();
```

---

#### `mcp.addServer`

**Description:** Add a new MCP server

**Input:**
```typescript
{
  name: string;
  description?: string;
  transport: "stdio" | "http";
  
  // For STDIO:
  command?: string;
  args?: string[];
  env?: Record<string, string>; // Will be encrypted
  
  // For HTTP:
  url?: string;
  token?: string; // Will be encrypted
}
```

**Output:**
```typescript
{
  server: MCPServerConfig;
}
```

**Example:**
```typescript
const server = await trpc.mcp.addServer.mutate({
  name: "Filesystem",
  transport: "stdio",
  command: "node",
  args: ["/path/to/server.js"]
});
```

---

#### `mcp.executeTool`

**Description:** Execute a tool from an MCP server

**Input:**
```typescript
{
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}
```

**Output:**
```typescript
{
  success: boolean;
  content?: Array<{
    type: "text" | "image" | "resource";
    text?: string;
  }>;
  error?: string;
  duration: number;
}
```

**Example:**
```typescript
const result = await trpc.mcp.executeTool.mutate({
  serverId: "fs-local",
  toolName: "read_file",
  arguments: { path: "/tmp/test.txt" }
});

console.log(result.content[0].text); // "File contents here..."
```

---

#### `mcp.listTools`

**Description:** List all available tools from all connected servers

**Input:** None

**Output:**
```typescript
{
  tools: Array<{
    serverId: string;
    serverName: string;
    name: string;
    description: string;
    inputSchema: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  }>
}
```

**Example:**
```typescript
const { tools } = await trpc.mcp.listTools.query();
console.log(tools.length); // 42 tools
```

---

#### `mcp.getToolHistory`

**Description:** Get execution history for a tool or server

**Input:**
```typescript
{
  serverId?: string; // Optional filter
  toolName?: string; // Optional filter
  limit?: number; // Default: 50
}
```

**Output:**
```typescript
{
  history: Array<{
    id: string;
    serverId: string;
    serverName: string;
    toolName: string;
    arguments: Record<string, any>;
    result?: any;
    duration: number;
    success: boolean;
    error?: string;
    createdAt: string;
    userId?: string;
    agentId?: string;
  }>
}
```

**Example:**
```typescript
const { history } = await trpc.mcp.getToolHistory.query({
  serverId: "fs-local",
  limit: 10
});
```

---

### 6.2 REST API (MCP Server)

**Endpoint:** `POST /api/mcp`

**Description:** CommandMate MCP server (HTTP transport)

**Authentication:** Bearer token in `Authorization` header

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "commandmate_create_task",
        "description": "Create a new task",
        "inputSchema": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "agentId": { "type": "string" }
          },
          "required": ["title", "agentId"]
        }
      }
    ]
  }
}
```

**Supported Methods:**
- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/unit/mcp-client-wrapper.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPClientWrapper } from "@/server/mcp/client/wrapper";

describe("MCPClientWrapper", () => {
  let wrapper: MCPClientWrapper;
  
  beforeEach(() => {
    const mockConfig = {
      id: "test-server",
      name: "Test Server",
      transport: "stdio",
      command: "node",
      args: ["test-server.js"]
    };
    
    wrapper = new MCPClientWrapper(mockConfig, mockTransport);
  });
  
  it("should connect to server", async () => {
    await wrapper.connect();
    expect(wrapper.connected).toBe(true);
  });
  
  it("should list tools", async () => {
    await wrapper.connect();
    const tools = await wrapper.listTools();
    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
  });
  
  it("should cache tool list", async () => {
    await wrapper.connect();
    
    const tools1 = await wrapper.listTools();
    const tools2 = await wrapper.listTools(); // Should use cache
    
    expect(tools1).toEqual(tools2);
    expect(wrapper.lastToolRefresh).toBeGreaterThan(0);
  });
  
  it("should execute tool", async () => {
    await wrapper.connect();
    
    const result = await wrapper.callTool("echo", { message: "hello" });
    
    expect(result.success).toBe(true);
    expect(result.content[0].text).toBe("hello");
  });
  
  it("should handle tool execution error", async () => {
    await wrapper.connect();
    
    await expect(
      wrapper.callTool("invalid_tool", {})
    ).rejects.toThrow("Tool not found");
  });
});
```

### 7.2 Integration Tests

```typescript
// __tests__/integration/mcp-flow.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MCPClientManager } from "@/server/mcp/client/manager";
import { PrismaClient } from "@prisma/client";

describe("MCP End-to-End Flow", () => {
  let manager: MCPClientManager;
  let db: PrismaClient;
  
  beforeAll(async () => {
    db = new PrismaClient();
    manager = new MCPClientManager(db);
    await manager.initialize();
  });
  
  afterAll(async () => {
    await db.$disconnect();
  });
  
  it("should connect to filesystem server", async () => {
    await manager.connectServer("fs-local");
    expect(manager.clients.has("fs-local")).toBe(true);
  });
  
  it("should list tools from all servers", async () => {
    const tools = await manager.listAllTools();
    expect(tools.length).toBeGreaterThan(0);
    
    const readFileTool = tools.find(t => t.name === "read_file");
    expect(readFileTool).toBeDefined();
    expect(readFileTool?.serverId).toBe("fs-local");
  });
  
  it("should execute read_file tool", async () => {
    // Create test file
    const fs = require("fs");
    const testPath = "/tmp/mcp-test.txt";
    fs.writeFileSync(testPath, "Hello, MCP!");
    
    // Execute tool
    const result = await manager.executeTool("fs-local", "read_file", {
      path: testPath
    });
    
    expect(result.success).toBe(true);
    expect(result.content[0].text).toBe("Hello, MCP!");
    
    // Cleanup
    fs.unlinkSync(testPath);
  });
  
  it("should log tool call to database", async () => {
    const beforeCount = await db.mCP_ToolCall.count();
    
    await manager.executeTool("fs-local", "list_directory", {
      path: "/tmp"
    });
    
    const afterCount = await db.mCP_ToolCall.count();
    expect(afterCount).toBe(beforeCount + 1);
    
    const latestCall = await db.mCP_ToolCall.findFirst({
      orderBy: { createdAt: "desc" }
    });
    
    expect(latestCall?.serverId).toBe("fs-local");
    expect(latestCall?.toolName).toBe("list_directory");
    expect(latestCall?.success).toBe(true);
  });
});
```

### 7.3 Load Tests

```typescript
// __tests__/load/mcp-performance.test.ts

import { describe, it, expect } from "vitest";
import { performance } from "perf_hooks";

describe("MCP Performance Tests", () => {
  it("should handle 100 concurrent tool calls", async () => {
    const manager = await getMCPClientManager();
    
    const startTime = performance.now();
    
    const promises = Array.from({ length: 100 }, (_, i) =>
      manager.executeTool("fs-local", "get_time", {})
    );
    
    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(5000); // < 5 seconds for 100 calls
  });
  
  it("should maintain stable memory under load", async () => {
    const manager = await getMCPClientManager();
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Execute 1000 tool calls
    for (let i = 0; i < 1000; i++) {
      await manager.executeTool("time-server", "get_current_time", {});
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be < 50MB
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
  });
});
```

---

## 8. Deployment Checklist

### 8.1 Pre-Deployment

- [ ] All tests passing (unit + integration + load)
- [ ] Database migrations applied
- [ ] Environment variables set in Vercel
- [ ] Redis configured (Upstash)
- [ ] Supabase Vault set up
- [ ] MCP servers tested individually
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Feature flags configured

### 8.2 Deployment

- [ ] Deploy to staging
- [ ] Smoke tests in staging
- [ ] MCP client manager working
- [ ] MCP server endpoint accessible
- [ ] OAuth flows working (GitHub, Slack)
- [ ] Tool execution successful
- [ ] Monitoring enabled (Sentry, Posthog)
- [ ] Rollback plan ready
- [ ] Deploy to production (Friday evening)
- [ ] Monitor for 24 hours
- [ ] Enable for beta users
- [ ] Full rollout (Monday)

### 8.3 Post-Deployment

- [ ] Monitor error rates (target: <1%)
- [ ] Monitor latency (target: p95 <1s)
- [ ] Monitor memory usage
- [ ] Check MCP tool call logs
- [ ] Verify caching working
- [ ] Test Claude Desktop integration
- [ ] Collect user feedback
- [ ] Address critical bugs within 24 hours
- [ ] Update documentation with learnings

---

## 9. Monitoring & Alerts

### 9.1 Key Metrics

```typescript
// src/server/lib/monitoring.ts

import { PostHog } from "posthog-node";
import * as Sentry from "@sentry/nextjs";

const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

export const trackMCPEvent = (event: string, properties: any) => {
  posthog.capture({
    distinctId: properties.userId || "system",
    event: `mcp.${event}`,
    properties
  });
};

// Track tool execution
export const trackToolCall = (data: {
  serverId: string;
  toolName: string;
  duration: number;
  success: boolean;
  userId?: string;
}) => {
  trackMCPEvent("tool_call", data);
  
  if (!data.success) {
    Sentry.captureMessage(`MCP tool call failed: ${data.toolName}`, {
      level: "warning",
      extra: data
    });
  }
};

// Track server health
export const trackServerHealth = (serverId: string, healthy: boolean) => {
  trackMCPEvent("server_health", { serverId, healthy });
  
  if (!healthy) {
    Sentry.captureMessage(`MCP server unhealthy: ${serverId}`, {
      level: "error"
    });
  }
};
```

### 9.2 Alert Configuration

```typescript
// Sentry alerts (configure in Sentry dashboard)
// 1. MCP server connection failures > 10/hour
// 2. Tool execution error rate > 5%
// 3. Tool latency p95 > 5s
// 4. Memory usage > 80%

// BetterUptime alerts
// 1. /api/mcp endpoint down
// 2. Response time > 3s
// 3. Error rate > 1%
```

---

## 10. Security Considerations

### 10.1 Input Validation

```typescript
// src/server/api/routers/mcp.ts

import { z } from "zod";

const AddServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  transport: z.enum(["stdio", "http"]),
  command: z.string().max(200).optional(),
  args: z.array(z.string().max(500)).max(10).optional(),
  env: z.record(z.string().max(1000)).optional(),
  url: z.string().url().max(500).optional(),
  token: z.string().max(2000).optional()
}).refine(
  (data) => {
    if (data.transport === "stdio") {
      return data.command && data.args;
    }
    return data.url;
  },
  { message: "Invalid server configuration for transport type" }
);

const ExecuteToolSchema = z.object({
  serverId: z.string().cuid(),
  toolName: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  arguments: z.record(z.any())
});
```

### 10.2 Authentication

```typescript
// src/server/api/routers/mcp.ts

// All MCP endpoints require authentication
export const mcpRouter = createTRPCRouter({
  listServers: protectedProcedure.query(async ({ ctx }) => {
    // ctx.session.user is automatically available
    // Only show servers for current user
    return await ctx.db.mcpServer.findMany({
      where: { userId: ctx.session.user.id }
    });
  }),
  
  executeTool: protectedProcedure
    .input(ExecuteToolSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the server
      const server = await ctx.db.mcpServer.findUnique({
        where: { id: input.serverId }
      });
      
      if (!server || server.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      // Execute tool...
    })
});
```

### 10.3 Rate Limiting

```typescript
// src/server/middleware/rate-limit.ts

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 req/min
  analytics: true
});

export const rateLimitMiddleware = async (userId: string) => {
  const { success, limit, remaining } = await ratelimit.limit(userId);
  
  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. ${remaining} remaining.`
    });
  }
  
  return { limit, remaining };
};
```

---

## Conclusion

This technical specification provides all the details needed for Thép ⚙️ to implement MCP integration in CommandMate.

**Key Deliverables:**
✅ TypeScript interfaces  
✅ Database schema  
✅ API documentation  
✅ Environment variables  
✅ Development setup  
✅ Testing strategy  
✅ Deployment checklist  
✅ Security guidelines

**Next Steps:**
1. Review this spec with Thép ⚙️
2. Clarify any questions
3. Begin Sprint 1 (Week 1-2)
4. Build prototype and validate

---

**Document Status:** ✅ COMPLETE - Ready for implementation

**Author:** Minh 📋  
**Reviewers:** Thép ⚙️ (Dev Lead), Sếp (Product Owner)  
**Version:** 1.0 (Final)
