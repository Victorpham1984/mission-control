# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

CommandMate / BizMate Business OS — AI Agent Operations Platform cho SME Việt Nam & Đông Nam Á. Orchestrate multi-agent (OpenClaw, CrewAI, LangChain) với outcome-based pricing.

### Strategy Decision (2026-03-13, Sếp Victor approved)

**CommandMate first, BizMate sau.** Hai track song song:
- **Track A (70%):** Ship CommandMate v1 MVP — MCP-native agent orchestration platform. Code trên `main`.
- **Track B (30%):** Design BizMate Business OS — docs/schema/wireframes only, KHÔNG code. Docs trên `pivot/business-os`.

CommandMate = engine (agent API, task pipeline, MCP tools). BizMate = product layer (CEO dashboard, playbooks, Shopee integration) build trên engine đó sau.

### Current Sprint (W1-W4: 2026-03-17 → 2026-04-11)

Sprint plan chi tiết: `docs/planning/sprint-plan-v1.md`

**W1 progress:**
- Day 1 ✅: Fix founder trigger + add task_comments + sync schema.sql (21 tables)
- Day 2 ✅: CI/CD pipeline + types.ts (21 types) + 11 smoke tests
- Day 3: (skipped — manual test verification)
- Day 4 ✅: Track B — schema risk mitigation, BLOCKERS.md, wireframe, playbook template
- Day 5 ✅: PRD v0.1 (12 sections), API audit (34 routes clean), PRD consistency review, `pivot/business-os` branch

**W2 focus:** MCP agent↔tool integration + SSE transport
**W3 focus:** Telegram notifications + metrics API
**W4 focus:** Agent creation UI + OutcomeDashboard + polish → MVP ready

### Blockers (Track B — resolve before Week 2)

- **Blocker 1 (P0):** Playbook content — Shopee Auto-Order steps chưa có nội dung. Template: `docs/planning/bizmate/playbook-shopee-auto-order.md`. Owner: Sếp Victor + Đệ. Deadline: 2026-03-20.
- **Blocker 2 (P0):** Shopee API access — chưa confirm. Fallback: manual CSV mode. Owner: Sếp Victor.
- **Blocker 3 (P1):** Playbook config schema — blocked by Blocker 1.
- Details: `docs/planning/bizmate/BLOCKERS.md`

### Known Issues

- ~~13 missing tables~~ **RESOLVED** (2026-03-17): 12/13 tables already existed in migrations, `schema.sql` was stale. `task_comments` added via `20260317_fix_founder_and_add_task_comments.sql`. `schema.sql` synced with all 19 migrations.
- ~~Founder trigger bug~~ **RESOLVED** (2026-03-17): `handle_new_workspace_founder()` fixed — moved `role`, `about`, `avatar_emoji` into `config` JSONB.

## Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint
npm test              # All tests (Jest, --runInBand --forceExit)
npm run test:mcp      # MCP tests only (src/lib/mcp)
```

Single test file: `npx jest path/to/test.ts --runInBand --forceExit`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) + React 19.2.3 |
| Language | TypeScript 5 (strict, ES2017) |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Styling | TailwindCSS 4.0 via PostCSS |
| State | TanStack React Query 5.90 |
| Forms | react-hook-form + zod validation |
| Charts | Recharts 3.7 |
| MCP | @modelcontextprotocol/sdk 1.27 |
| Testing | Jest 30 + ts-jest (30s timeout) |
| Deploy | Vercel |

## Architecture

**Next.js App Router** with file-based routing. API routes under `src/app/api/`, UI pages under `src/app/`.

### Key layers

- **`src/app/api/v1/`** — Versioned REST API (agents, tasks, approvals, mcp, metrics, notifications, workspace)
- **`src/lib/mcp/`** — MCP client infrastructure: `MCPClient` (retry + circuit breaker), `MCPServerRegistry` (multi-server singleton), `MCPMetrics` (perf tracking)
- **`src/lib/supabase/`** — Client (`client.ts` for browser, `server.ts` for API routes with service role), middleware, React hooks
- **`src/lib/notifications/`** — Telegram + dashboard notification adapters
- **`src/components/`** — React client components (modals, dashboards)
- **`src/providers/`** — TanStack Query provider

### Database (Supabase)

- Schema files: `src/lib/supabase/schema.sql`, `src/lib/mcp/schema.sql`
- RLS enforces workspace-scoped data isolation
- All tables: profiles, workspaces, workspace_members, workspace_api_keys, agents, agent_skills, agent_heartbeats, agent_profiles, agent_examples, task_queue (primary), tasks (legacy), task_history, task_comments, task_evaluations, messages, workspace_documents (pgvector), notification_log, webhooks, webhook_logs, mcp_servers, mcp_tool_usage
- Auto-creation triggers: signup → profile → workspace → API key + founder agent
- `schema.sql` is documentation only. Source of truth: `supabase/migrations/*.sql`

### MCP Integration

- Servers registered per-workspace in `mcp_servers` table
- Transports: **stdio** (subprocess, default) and **SSE** (HTTP + Server-Sent Events)
- Tool execution: POST `/api/v1/mcp/tools` → MCPServerRegistry → MCPClient
- Agent↔tool: `AgentToolExecutor` (`src/lib/mcp/agent-integration.ts`) — atomic task ownership + tool execution within task context
- Agent tool API:
  - GET `/api/v1/tasks/{taskId}/tools` — discover MCP tools for a task
  - POST `/api/v1/tasks/{taskId}/execute-tool` — execute tool in task context
- Shared singleton: `getSharedRegistry()` (`src/lib/mcp/registry-singleton.ts`)
- Circuit breaker: opens after 5 failures/1min; retry: exponential backoff, max 3 attempts
- Tool cache TTL: 5 minutes; execution timeout: 30s (stdio), 10s (SSE)
- Docs: `docs/MCP_QUICKSTART.md`, `docs/CLAUDE_DESKTOP_SETUP.md`

### Playbook Execution

- `PlaybookExecutor` (`src/lib/playbooks/executor.ts`) — reads installed playbook config, spawns tasks
- Run endpoint: POST `/api/v1/installed-playbooks/{id}/run`
  - Parses `playbook.config.steps[]`, creates 1 task per step in `task_queue`
  - Each task gets `PlaybookTaskMetadata`: `playbook_run_id`, `step_order`, `step_action`, etc.
  - Idempotency: rejects 409 if in-flight tasks exist; two-phase concurrent safety
- `ActionLogger` (`src/lib/playbooks/action-logger.ts`) — bridges task complete/fail → `actions` table
  - Wired into `tasks/{id}/complete` and `tasks/{id}/fail` routes (non-blocking)
  - Logs both success and failure paths; skips non-playbook tasks
- Notification: task completion triggers `NotificationService` → Telegram (with approval buttons) or Dashboard
- Demo: `npx tsx scripts/demo-playbook-loop.ts`

## Coding Conventions

### Commit format

Conventional Commits with scope, English, lowercase:

```
feat(mcp): add SSE transport support
fix(auth): resolve cookie session race condition
docs: update MCP setup guide
chore: upgrade supabase-js to 2.96
```

Prefixes: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`
Common scopes: `mcp`, `auth`, `agents`, `tasks`, `approvals`, `ui`, `schema`
Bug tickets: `fix(BUG-007): ...`

### Branch strategy

- `main` — production, luôn deployable. Track A code goes here.
- `pivot/business-os` — Track B docs only (PRD, schema design, wireframes). KHÔNG code.
- Feature branches: `feat/<scope>-<description>` (e.g. `feat/mcp-sse-transport`)
- Bugfix branches: `fix/<description>`

### Ngôn ngữ

- **Code** (variables, functions, types, inline comments): English
- **Docs** (`docs/` directory, planning files): tiếng Việt (trừ technical docs như MCP guides giữ English)
- **Commit messages**: English
- **UI text**: English (chuyển Vietnamese-first khi pivot sang BizMate)

### TypeScript

- Path alias: `@/*` maps to `src/*`
- Strict mode — no `any` unless unavoidable
- Supabase server client (service role key) cho API routes
- Supabase browser client cho client components
- Validate input với zod ở API boundaries

### Database migrations

- Migration files: `supabase/migrations/YYYYMMDD_description.sql`
- Always add RLS policies for new tables
- Always add indexes for foreign keys and frequently filtered columns
- Test migrations on staging before production

## Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Optional: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `CRON_SECRET`, `ADMIN_PASSWORD`
Template: `.env.example`

## Key Documentation

### Planning & Strategy
- `docs/planning/sprint-plan-v1.md` — current sprint plan (W1-W4)
- `docs/planning/project-audit-2026-03-13.md` — full project audit
- `docs/planning/bizmate/PRD-draft.md` — BizMate Business OS PRD (Track B)
- `docs/planning/bizmate/schema-design.md` — BizMate DB schema (7 tables, soft delete, pgcrypto)
- `docs/planning/bizmate/wireframe-onboarding.md` — 6-step onboarding wizard
- `docs/planning/bizmate/BLOCKERS.md` — critical blockers + mitigation
- `docs/planning/bizmate/playbook-shopee-auto-order.md` — Shopee playbook template (WIP)

### Legacy Strategy (context, not active plans)
- `docs/commandmate-legacy/STRATEGY-2026.md` — strategic direction
- `docs/commandmate-legacy/business-model-v2.md` — business model & pricing
- `docs/commandmate-legacy/ROADMAP-WITH-MCP.md` — 10-month roadmap

### Research & Migration
- `docs/migration/MIGRATION_GUIDE.md` — Business OS pivot plan
- `docs/research/BIZMATE_BUSINESS_OS_BLUEPRINT_V1.md` — competitive research (53KB)
- `docs/research/EXECUTIVE_SUMMARY_FOR_SEP.md` — Polsia analysis summary

### Technical Guides
- `docs/MCP_QUICKSTART.md` — 5-minute MCP setup
- `docs/CLAUDE_DESKTOP_SETUP.md` — Claude Desktop integration
- `docs/MCP_SETUP_GUIDE.md` — MCP architecture reference


## gstack Skills

Use gstack skills from ~/.claude/skills/gstack for specialized workflows.
Available slash commands:

| Command | Role | When to use |
|---------|------|-------------|
| /plan-ceo-review | Founder/CEO | Before coding — rethink the real problem, find "10-star product" |
| /plan-eng-review | Eng Manager | Lock architecture, data flow, edge cases, test matrix |
| /review | Staff Engineer (paranoid) | Before commit — find bugs that pass CI but blow up production |
| /ship | Release Engineer | Sync main, run tests, push branch, open PR |
| /browse | QA Engineer | Navigate app with "eyes" — click, screenshot, verify flows |
| /qa | QA Lead | Systematic testing with health scores + regression tracking |
| /setup-browser-cookies | Session Manager | Import cookies from Chrome/Brave into headless session |
| /retro | Eng Manager | Team retro from git history — per-person praise + growth areas |

### Recommended workflow per feature

1. `/plan-ceo-review` — rethink problem at founder level
2. `/plan-eng-review` — lock architecture + test plan
3. Implement the plan
4. `/review` — paranoid review before commit
5. `/ship` — push + open PR
6. `/qa https://staging-url --quick` — smoke test staging

### Rules
- For web browsing, always use `/browse` skill, never `mcp__claude-in-chrome__*` tools
- `/qa` output includes health score (0-100) — flag anything below 80
- `/review` should catch: race conditions, N+1 queries, trust boundary violations, missing error handling

