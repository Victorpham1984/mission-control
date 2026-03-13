# Project Audit — CommandMate / BizMate Business OS

**Ngày:** 2026-03-13
**Phạm vi:** Toàn bộ codebase mateclaw + docs (legacy, migration, research)

---

## A. Bức tranh toàn cảnh (Executive Summary)

CommandMate (tên code: Mission Control / mateclaw) là **AI Agent Operations Platform** do BizMate (Sếp Victor) xây dựng, nhắm vào SME Việt Nam và Đông Nam Á. Dự án bắt đầu như dashboard quản lý AI agent, sau đó pivot sang **Business OS** — nền tảng orchestrate multi-agent (OpenClaw, CrewAI, LangChain) với pricing theo outcome thay vì per-seat. Tech stack: Next.js 16 + Supabase + TypeScript, deploy trên Vercel. Kiến trúc 4 lớp: Agent Layer (API + task queue), Data Layer (knowledge base + pgvector), Human Layer (dashboard + Telegram/Zalo approval), Infra Layer (MCP + connectors + billing). Dự án đã hoàn thành Phase 1 (agent registration, task CRUD, approval workflow, dashboard kanban) và Phase 3 Week 1 (MCP client infrastructure với retry/circuit breaker, 31 tests passing). Research 14 ngày về đối thủ Polsia đã xong, chỉ ra 18 điểm yếu có thể khai thác — đặc biệt Polsia không hỗ trợ tiếng Việt, không tích hợp Shopee, và đắt gấp 4-5x ở scale. Revenue target: $100K MRR tháng 12, $200K ARR Year 1. Migration guide đã chuẩn bị cho pivot sang "BizMate Business OS" với schema mới (companies, goals, KPIs, playbooks). Hiện tại codebase ~43% API endpoints và ~47% UI pages đã implement, phần còn lại là stub. MCP integration production-ready nhưng chưa kết nối vào agent workflow chính.

---

## B. Đã build gì, đang ở đâu, thiếu gì

### Đã build (Production-ready)

- **Auth flow** hoàn chỉnh: email/password signup + login, auto-create profile → workspace → founder agent
- **Agent management**: register, heartbeat polling (30s), status tracking (online/away/offline), profile CRUD
- **Task pipeline**: create → auto-assign (skill matching) → complete → pending-approval → approve (rating 1-5)
- **Dashboard chính** (`/page.tsx`): Kanban 5 cột, agent sidebar, activity feed, real-time Supabase subscriptions
- **MCP infrastructure** (Phase 3 Week 1): MCPClient (stdio transport, retry, circuit breaker), MCPServerRegistry, MCPMetrics, admin UI `/mcp`, CRUD API cho servers
- **UI pages hoạt động**: Dashboard, Login/Signup, Agents list, Settings, MCP admin, Cron jobs, Hooks manager, Routing diagram
- **Webhook dispatch**: fire-and-forget cho task events
- **OpenClaw gateway**: cron + hooks + routing integration

### Đang ở đâu

- **Phase 1**: ✅ Done
- **Phase 2** (Learning Agents + Knowledge Base): ~95% theo roadmap cũ, nhưng chưa thấy pgvector/embedding code
- **Phase 3** (MCP): Week 1 done, Week 2-8 chưa bắt đầu
- **Pivot**: Migration guide viết xong nhưng chưa tạo branch `pivot/business-os`, schema mới chưa apply

### Thiếu / Stub

| Thiếu | Mức độ |
|-------|--------|
| DB schema thiếu tables: `task_queue`, `agent_heartbeats`, `agent_skills`, `workspace_api_keys` (code dùng nhưng không có trong schema.sql) | **P0** |
| Founder agent trigger reference fields không tồn tại (`role`, `about`, `avatar_emoji`) | **P0** |
| Chat backend + UI (`/chat`, `/chat/live`) | **P1** |
| Agent creation page (`/agents/new`) | **P1** |
| Multi-user workspace (table `workspace_members` có nhưng chưa integrate) | **P1** |
| Reject approval workflow (hardcoded empty) | **P1** |
| Metrics endpoints (`/metrics/agents`, `/metrics/outcomes`) | **P1** |
| Telegram/Zalo notification adapters (defined nhưng chưa implement) | **P1** |
| Knowledge base / pgvector search | **P1** |
| Onboarding flow (`/onboarding`) | **P2** |
| Sessions/history (`/sessions`) | **P2** |
| API docs page (`/docs`) | **P2** |
| GitHub OAuth (disabled) | **P2** |
| Billing / Stripe / outcome-based pricing | **Phase 4** |

---

## C. Tech Stack + DB Schema hiện tại

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) + React 19.2.3 |
| Language | TypeScript 5 (strict, ES2017, path alias `@/*`) |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Styling | TailwindCSS 4.0 via PostCSS |
| State | TanStack React Query 5.90 |
| Forms | react-hook-form + zod validation |
| Charts | Recharts 3.7 |
| MCP | @modelcontextprotocol/sdk 1.27 |
| Testing | Jest 30 + ts-jest (30s timeout) |
| Deploy | Vercel |
| Linting | ESLint 9 (Next.js core web vitals) |

### DB Schema (7 tables + 2 MCP tables)

```
profiles (extends auth.users)
├── id, email, full_name, avatar_url, timezone
└── RLS: user owns own profile, auto-created on signup

workspaces
├── id, name, slug (unique per owner), owner_id, plan (starter|pro|team), settings (JSONB)
└── Auto-creates on profile creation, auto-creates founder agent

workspace_members (prepared, not integrated)
├── workspace_id, user_id, role (owner|admin|member)

agents
├── id, workspace_id, name, type (openclaw|crewai|custom|founder)
├── status (online|offline|error|paused), config (JSONB)
├── external_id, last_seen_at, description, avatar_url
└── RLS: workspace owner CRUD

tasks
├── id, agent_id, workspace_id, status (pending|running|completed|failed)
├── input (JSONB), output (JSONB), error, duration_ms, cost_estimate
└── Realtime enabled

messages
├── id, agent_id, workspace_id, direction (in|out), content, metadata, is_broadcast
└── Realtime enabled

mcp_servers
├── id, workspace_id, name, transport (stdio|sse), command, args, env, url, timeout, enabled
└── Unique name per workspace

mcp_tool_usage
├── server_id, tool_name, duration_ms, status (success|error), error_message
└── Materialized view: mcp_tool_stats (aggregated)
```

**Schema issues**: Code references `task_queue`, `agent_heartbeats`, `agent_skills`, `workspace_api_keys` — nhưng không có trong schema.sql. Trigger tạo founder agent dùng fields không tồn tại (`role`, `about`, `avatar_emoji`).

---

## D. Pivot Direction từ Migration Guide

Migration guide mô tả pivot từ **CommandMate** (MCP-focused agent dashboard) sang **BizMate Business OS** — nền tảng operations cho SME Đông Nam Á, đặc biệt e-commerce.

### Thay đổi chính

1. **UI pivot**: Từ developer-facing kanban → **CEO dashboard** với onboarding wizard, KPI tracking, playbook marketplace
2. **Schema mới** cần thêm:
   - `companies` (company profile, industry, size)
   - `goals` (business goals với KPIs)
   - `kpis` (measurable metrics)
   - `playbooks` (workflow templates — tương tự "recipes")
   - `installed_playbooks` (per-company instances)
   - `actions` (discrete steps trong playbook)
3. **Feature flags** cho gradual rollout (giữ cả legacy + new UI)
4. **Branching**: `pivot/business-os` branch, giữ `main` ổn định
5. **Target user shift**: Từ developer/agent builder → **SME owner/CEO** không biết code
6. **Competitive angle**: Fork Polsia's proven patterns nhưng localize cho Việt Nam + tích hợp Shopee/Lazada + pricing rẻ hơn 76-90%

### Research findings driving pivot

- Polsia (đối thủ global) có 18 điểm yếu exploitable: English-only, no Shopee, Stripe-only, $0.98/task đắt ở scale
- TAM Đông Nam Á: $4.08B (680M dân, 60% SMB)
- First-mover window: 12 tháng trước khi Polsia có thể pivot sang SEA
- BizMate 7 moats: Vietnamese UI, Shopee 1-click, local payments, 76-90% rẻ hơn, SEO-first GTM, security-first, community network effects

---

## E. Top 10 việc cần làm (ưu tiên + effort)

| # | Việc | Ưu tiên | Effort | Lý do |
|---|------|---------|--------|-------|
| **1** | Fix DB schema: thêm tables thiếu (`task_queue`, `agent_heartbeats`, `agent_skills`, `workspace_api_keys`) + fix founder agent trigger | **P0** | 1-2 ngày | Code đang reference tables không tồn tại → runtime errors cho bất kỳ flow nào dùng các tables này |
| **2** | Quyết định pivot direction: tiếp tục CommandMate hay chuyển BizMate Business OS | **P0** | 1 ngày (decision) | Mọi development phụ thuộc quyết định này — 2 hướng khác nhau hoàn toàn về UI, schema, target user |
| **3** | Implement Knowledge Base + pgvector search | **P0** | 1-2 tuần | Đây là "moat" chiến lược — data layer càng sớm càng tích lũy giá trị. Phase 2 ghi 95% done nhưng chưa thấy code |
| **4** | Hoàn thiện MCP Phase 3: GitHub server, SSE transport, agent integration | **P1** | 3-4 tuần | MCP client infrastructure done nhưng chưa kết nối vào agent workflow chính — agents chưa thể gọi MCP tools |
| **5** | Implement Telegram/Zalo notification + approval flow | **P1** | 1-2 tuần | Strategy doc nói 80% usage qua Telegram — hiện adapter defined nhưng chưa implement. Đây là primary UX |
| **6** | Build agent creation UI + skills management | **P1** | 3-5 ngày | `/agents/new` là stub, không có cách tạo agent từ UI ngoài auto-register qua API |
| **7** | Implement metrics endpoints + OutcomeDashboard | **P1** | 1 tuần | Strategy nói "outcome dashboard" thay kanban là north star UI — cần data pipeline cho agent performance, task success rate, cost tracking |
| **8** | Multi-user workspace (invite, RBAC, member management) | **P2** | 2 tuần | `workspace_members` table có sẵn nhưng chưa integrate. Cần cho team plan ($149/mo) |
| **9** | Chat interface backend + SquadChat | **P2** | 1-2 tuần | Chat pages là stub, SquadChatModal component có nhưng thiếu backend |
| **10** | Billing engine (outcome-based pricing, Stripe/local payments) | **P2** | 3-4 tuần | Phase 4 trong roadmap. Cần cho monetization nhưng phụ thuộc pivot decision (BYOK vs Managed tiers) |

**Tổng effort ước tính**: ~12-16 tuần cho toàn bộ, hoặc ~4-6 tuần nếu focus P0+P1 critical path.

---

## Phụ lục: Implementation Coverage

| Metric | Số liệu |
|--------|---------|
| API endpoints implemented | ~15/35 (43%) |
| UI pages implemented | ~9/19 (47%) |
| Database tables (in schema.sql) | 9 core (6 thiếu/stub) |
| MCP tests passing | 31/31 |
| Total TypeScript files | ~108 |
| Auth | Full (email/password + API key SHA-256) |
| Real-time | Supabase subscriptions working |

### Tài liệu đã review

- `docs/commandmate-legacy/` — README, ARCHITECTURE, STRATEGY-2026, business-model-v2, PHASE-1-PLAN, PHASE-2-PLAN, ROADMAP-WITH-MCP, LEARNINGS
- `docs/migration/MIGRATION_GUIDE.md`
- `docs/research/` — INDEX, EXECUTIVE_SUMMARY_FOR_SEP, BIZMATE_BUSINESS_OS_BLUEPRINT_V1, DAYS_1-14_COMPLETE (292KB total, 14-day research)
- `docs/MCP_QUICKSTART.md`, `CLAUDE_DESKTOP_SETUP.md`, `MCP_SETUP_GUIDE.md`, `WEEK1_FINAL_REPORT.md`
- `package.json`, `src/app/**`, `src/lib/**`, `src/components/**`
