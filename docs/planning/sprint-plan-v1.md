# Sprint Plan v1 — CommandMate First + BizMate Design

**Ngày tạo:** 2026-03-13
**Chiến lược:** Sếp Victor đã chốt — CommandMate ship trước (engine), BizMate Business OS design song song (product layer sau)
**Timeline:** 4 tuần (2026-03-17 → 2026-04-11)
**Phân bổ:** Track A 70% effort, Track B 30% effort

---

## Tổng quan 4 tuần

| Tuần | Track A: CommandMate v1 Ship | Track B: BizMate OS Design | Milestone |
|------|------------------------------|---------------------------|-----------|
| **W1** (17-21/3) | Fix DB schema (13 missing tables) + founder trigger + CI/CD | PRD + DB schema design + onboarding wireframe | App chạy end-to-end, CI green |
| **W2** (24-28/3) | MCP Phase 3: agent↔MCP integration + SSE transport | User journey maps + playbook system design | Agents gọi được MCP tools |
| **W3** (31/3-4/4) | Telegram notification + approval flow + metrics endpoints | Pricing model chi tiết + competitive positioning doc | Approval qua Telegram hoạt động |
| **W4** (7-11/4) | Agent creation UI + OutcomeDashboard + polish | Design review tổng hợp + pivot readiness checklist | **CommandMate v1 MVP ready** |

---

## Tuần 1 — Chi tiết theo ngày (17-21/3)

### Track A: Fix Foundation (70% = ~3.5 ngày)

---

#### Day 1 (Thứ 2, 17/3) — DB Schema: Core Tables

**Mục tiêu:** Tạo migration cho tất cả missing tables mà code đang reference.

| Task | Effort | Deliverable |
|------|--------|-------------|
| A1.1: Tạo `task_queue` table | M | `supabase/migrations/20260317_add_task_queue.sql` |
| A1.2: Tạo `agent_heartbeats` table | S | Cùng migration file |
| A1.3: Tạo `agent_skills` table | S | Cùng migration file |
| A1.4: Tạo `workspace_api_keys` table | S | Cùng migration file |
| A1.5: Fix `handle_new_workspace_founder()` trigger — bỏ `role`, `about`, `avatar_emoji` hoặc thêm columns vào agents | S | Cùng migration file |

**Chi tiết task_queue (bảng quan trọng nhất — 40+ references):**
```sql
-- Columns cần có (extracted từ code):
-- id, workspace_id, title, description, type, priority, status,
-- assigned_agent_id, required_skills, needs_approval,
-- approval_status, approval_rating, feedback_text,
-- parent_task_id, batch_id, batch_index, metadata, output, error,
-- learned_at, claimed_at, created_at, updated_at
```

**Definition of Done:**
- [ ] Migration file tạo đúng tất cả columns mà code reference
- [ ] RLS policies cho workspace scoping
- [ ] Indexes cho status, workspace_id, assigned_agent_id
- [ ] `npm run build` pass — không còn runtime errors khi hit các API endpoints
- [ ] Founder agent trigger không crash khi tạo workspace mới

**Dependencies:** Không

---

#### Day 2 (Thứ 3, 18/3) — DB Schema: Supporting Tables + Verify

| Task | Effort | Deliverable |
|------|--------|-------------|
| A2.1: Tạo `task_history` table | S | `supabase/migrations/20260318_add_supporting_tables.sql` |
| A2.2: Tạo `task_comments` table | S | Cùng migration file |
| A2.3: Tạo `task_evaluations` table | S | Cùng migration file |
| A2.4: Tạo `notification_log` table | S | Cùng migration file |
| A2.5: Tạo `webhooks` + `webhook_logs` tables | S | Cùng migration file |
| A2.6: Tạo `agent_profiles` + `agent_examples` tables | M | Cùng migration file |
| A2.7: Tạo `workspace_documents` table | S | Cùng migration file |
| A2.8: Verify — chạy từng API endpoint, confirm không còn "relation does not exist" | M | Test log / checklist |

**Definition of Done:**
- [ ] Tất cả 13 missing tables đã có migration
- [ ] `npm run build` pass
- [ ] `npm test` pass (31 MCP tests + any existing)
- [ ] Manual test: register agent → create task → complete → approve — full flow works
- [ ] Cập nhật `src/lib/supabase/schema.sql` reflect toàn bộ schema mới

**Dependencies:** A1.* phải xong

---

#### Day 3 (Thứ 4, 19/3) — CI/CD + End-to-End Smoke Test

| Task | Effort | Deliverable |
|------|--------|-------------|
| A3.1: Setup GitHub Actions: lint + test on PR | M | `.github/workflows/ci.yml` |
| A3.2: Verify `npm run lint` pass clean (fix warnings nếu có) | S | Clean lint output |
| A3.3: Verify `npm run build` pass trên CI | S | Green CI badge |
| A3.4: Write smoke test cho critical path: register → task → approve | M | `src/lib/__tests__/smoke.test.ts` |
| A3.5: Cập nhật `src/lib/supabase/types.ts` với types cho tables mới | M | Updated type definitions |

**CI workflow cần có:**
```yaml
# Triggers: push to main, PR to main
# Jobs: lint, test, build
# Node 22, pnpm
```

**Definition of Done:**
- [ ] PR tới main tự động chạy lint + test + build
- [ ] Smoke test cover: agent register, task create, task complete, task approve
- [ ] TypeScript types match DB schema cho tất cả tables mới
- [ ] CI green trên main branch

**Dependencies:** A2.* phải xong

---

#### Day 4 (Thứ 5, 20/3) — Track B: BizMate PRD + Schema Design

| Task | Effort | Deliverable |
|------|--------|-------------|
| B1.1: Viết BizMate Business OS PRD v0.1 | L | `docs/planning/bizmate/PRD-draft.md` (hoàn thiện từ template) |
| B1.2: Design DB schema cho Business OS tables | M | `docs/planning/bizmate/schema-design.md` |
| B1.3: Wireframe onboarding wizard (text-based) | M | `docs/planning/bizmate/wireframe-onboarding.md` |

**PRD cần trả lời:**
- Target user là ai? (CEO/owner SME Việt Nam, non-tech)
- Core problem? (Quản lý vận hành thủ công, không scale được)
- Top 5 features MVP?
- Success metrics? (signups, task completions, retention)
- Không build gì? (anti-scope)

**Schema design cần có:**
```
companies → goals → kpis (hierarchy)
playbooks → installed_playbooks → actions (template system)
Relationship với existing tables (workspaces, agents, tasks)
```

**Definition of Done:**
- [ ] PRD có đủ sections: Problem, User, Features, Metrics, Anti-scope
- [ ] Schema design có ERD text + column definitions + relationships
- [ ] Onboarding wireframe mô tả 5-7 bước từ signup → first task complete
- [ ] Tất cả files trong `docs/planning/bizmate/`

**Dependencies:** Không (Track B độc lập)

---

#### Day 5 (Thứ 6, 21/3) — Track A: Polish + Track B: Review

| Task | Effort | Deliverable |
|------|--------|-------------|
| A5.1: Fix bất kỳ issues phát hiện trong Day 1-3 | S-M | Bug fixes |
| A5.2: Verify toàn bộ stub endpoints return proper error (501 Not Implemented) thay vì crash | M | Consistent error responses |
| A5.3: Cập nhật CLAUDE.md với schema changes | S | Updated CLAUDE.md |
| B2.1: Self-review PRD — check consistency với research docs | S | PRD v0.2 updates |
| B2.2: Tạo `pivot/business-os` branch với Track B docs | S | Branch created, docs committed |

**Definition of Done:**
- [ ] `npm run build` + `npm test` + `npm run lint` = all green
- [ ] CI pipeline green trên main
- [ ] Track B docs committed trên `pivot/business-os` branch
- [ ] CLAUDE.md reflects current state
- [ ] **Week 1 milestone: App chạy end-to-end, CI green, PRD draft done**

**Dependencies:** A3.*, B1.*

---

## Tuần 2 (24-28/3) — MCP Agent Integration + User Journeys

### Track A: MCP Phase 3 Continuation

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| A6: Agent↔MCP tool integration — agents có thể discover + call MCP tools trong task execution | L | Updated `src/app/api/v1/tasks/[taskId]/complete/route.ts`, new `src/lib/mcp/agent-integration.ts` | Agent claims task → calls MCP tool → returns result → task complete | W1 done |
| A7: SSE transport support cho MCPClient | M | Updated `src/lib/mcp/MCPClient.ts` | MCP server với SSE transport connect + execute tools thành công | W1 done |
| A8: Connection pooling cho MCPServerRegistry | M | Updated `src/lib/mcp/MCPServerRegistry.ts` | Multiple concurrent tool calls không tạo duplicate connections | A7 |
| A9: Tests cho agent-MCP integration | M | `src/lib/mcp/__tests__/agent-integration.test.ts` | ≥10 tests covering happy path + error cases | A6 |

### Track B: User Journey + Playbook Design

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| B3: User journey maps (3 personas: CEO, Manager, Agent) | M | `docs/planning/bizmate/user-journeys.md` | Mỗi persona có journey từ awareness → activation → retention | B1.1 |
| B4: Playbook system design — how templates work end-to-end | M | `docs/planning/bizmate/playbook-system.md` | Template structure, install flow, execution flow, marketplace model | B1.2 |

**Week 2 milestone:** Agents gọi được MCP tools trong task execution flow.

---

## Tuần 3 (31/3-4/4) — Notifications + Metrics + Pricing

### Track A: Telegram + Metrics

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| A10: Implement TelegramAdapter — send task notifications | L | `src/lib/notifications/telegram-adapter.ts` | Task complete → Telegram message with approve/reject buttons | W1 (notification_log table) |
| A11: Telegram webhook receiver — handle approve/reject callbacks | M | `src/app/api/v1/webhooks/telegram/route.ts` | Tap approve button → task approved, rating saved | A10 |
| A12: Implement `/api/v1/metrics/agents/[agentId]` | M | Updated route file | Returns: tasks completed, avg rating, success rate, active hours | W1 (tables) |
| A13: Implement `/api/v1/metrics/outcomes` | M | Updated route file | Returns: daily completions, approval rate, avg duration, cost | A12 |

### Track B: Pricing + Competitive

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| B5: Pricing model chi tiết cho cả CommandMate + BizMate | M | `docs/planning/bizmate/pricing-model.md` | Tier definitions, unit economics, margins, comparison table | B1.1 |
| B6: Competitive positioning doc | M | `docs/planning/bizmate/competitive-positioning.md` | Feature matrix vs Polsia/Jasper/Copy.ai, messaging framework | B1.1 |

**Week 3 milestone:** Approval qua Telegram hoạt động, metrics API ready.

---

## Tuần 4 (7-11/4) — Polish + MVP Ready

### Track A: UI + Polish

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| A14: Agent creation UI (`/agents/new` page) | M | `src/app/agents/new/page.tsx` | Form: name, type, skills, description → agent created in DB | W1 (tables) |
| A15: OutcomeDashboard component — real data | L | Updated `src/components/OutcomeDashboard.tsx` | Charts: completions/day, success rate, cost trend, top agents | A12, A13 |
| A16: Fix tất cả stub endpoints — return 501 hoặc implement basic version | M | Multiple route files | No endpoint crashes with 500 | W1-W3 |
| A17: End-to-end testing + bug fixes | M | Test results, bug fixes | Full flow works: signup → agent → task → MCP tool → complete → Telegram approve | All |

### Track B: Design Review + Pivot Readiness

| Task | Effort | Deliverable | DoD | Deps |
|------|--------|-------------|-----|------|
| B7: Design review tổng hợp — consolidate all Track B docs | M | `docs/planning/bizmate/DESIGN_REVIEW.md` | Summary of all decisions, open questions, risk assessment | B3-B6 |
| B8: Pivot readiness checklist | S | `docs/planning/bizmate/PIVOT_CHECKLIST.md` | Prerequisites trước khi bắt đầu code BizMate: schema ready, PRD approved, wireframes reviewed | B7 |

**Week 4 milestone: CommandMate v1 MVP ready** — full flow hoạt động, CI green, Telegram notifications, metrics dashboard.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| 13 missing tables quá nhiều để tạo + test trong 2 ngày | Delay W1 | Ưu tiên task_queue + workspace_api_keys (critical path), còn lại có thể push sang Day 3 |
| Supabase migration conflicts | Block W1 | Backup DB trước khi chạy migration, test trên staging trước |
| Telegram Bot API setup phức tạp hơn dự kiến | Delay W3 | Fallback: dashboard-only notifications, Telegram push sang W4 |
| MCP SSE transport có breaking changes | Block W2 | Giữ stdio transport làm default, SSE là optional |
| Track B docs quality thấp vì chỉ 30% effort | Weak pivot foundation | Focus vào PRD + schema — wireframes có thể simplified text descriptions |

---

## Definition of Done — MVP (Cuối tuần 4)

- [ ] 13 missing DB tables đã migrate + verified
- [ ] CI/CD: lint + test + build green trên mọi PR
- [ ] Agent register → heartbeat → task assign → MCP tool call → complete → approve: full flow
- [ ] Telegram notifications cho task completion + approval
- [ ] Metrics API: agent performance + outcome dashboard
- [ ] Agent creation UI functional
- [ ] OutcomeDashboard với real data
- [ ] 0 endpoints crash với 500 (stub trả 501)
- [ ] BizMate PRD v1 + schema design + onboarding wireframe + pricing model ready
- [ ] `pivot/business-os` branch có toàn bộ Track B docs
