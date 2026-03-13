# Phase 3 Learnings — MCP Integration

## Week 3-4 (Feb 25, 2026)

### 1. MCP Server Architecture
- **InMemoryTransport** is perfect for testing MCP servers without stdio
- The MCP SDK's `Client` + `Server` can be linked via `InMemoryTransport.createLinkedPair()`
- Never access internal `_requestHandlers` — use the proper Client SDK

### 2. Error Design
- Specific error classes > generic Error objects
- Every error needs: code (for programmatic handling), message (for humans), context (for debugging)
- Actionable messages: "Do X to fix" not just "X failed"

### 3. Credential Security
- Supabase Vault is ideal but not always available
- Fallback pattern: try Vault → fall back to encrypted column storage
- Always validate token formats before storage (prevents storing garbage)

### 4. Catalog Design
- Static catalog with runtime search is simpler than database-backed catalog
- `validateEnvVars` per-server is essential UX — catch errors before install, not after
- Popularity scores help with default sorting

### 5. Testing Strategy
- Test at the protocol level (Client ↔ Server), not at handler level
- Mock at the data layer (Supabase), not at the protocol layer
- 117 tests across 11 files — regression safety is high
