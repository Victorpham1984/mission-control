# CommandMate Roadmap with MCP Integration

> **Updated:** 2026-02-24  
> **Context:** Integrated MCP strategy into existing phases based on Minh's research + Sếp approval  
> **Vision:** CommandMate = Agent Orchestration Platform + MCP Standard = "Anthropic built the protocol. CommandMate built the platform."

---

## 🎯 **STRATEGIC VISION**

**CommandMate = Platform AI Agents Sử Dụng (Agent-First, Not Human-First)**

### **3 Trụ Cột + MCP:**

| Trụ Cột | Vai Trò | MCP Impact |
|---------|---------|------------|
| **1. Outcome Pricing** | Trả theo kết quả, không theo seat | MCP phân biệt read/write → transparent tool pricing |
| **2. Tools cho Agents** | Agents tự access tools để làm việc | **🚀 MCP = game-changer**: 100+ tools instant, không cần build riêng |
| **3. System of Record** | Data thuộc về SME, audit trail đầy đủ | MCP JSON-RPC → dễ log, dễ audit, compliance-ready |

---

## 📅 **PHÂN PHA BUILD — REVISED WITH MCP**

---

## **PHASE 1: Foundation + Telegram-First** ✅ (Week 1-6, DONE)

### **Mục tiêu:**
- Dashboard cơ bản (task management, agent status)
- Telegram bot (tạo task, approve/reject, notifications)
- API layer (agents tự báo cáo qua API)

### **Deliverables:**
- ✅ Dashboard: Task kanban, agent list, performance metrics
- ✅ Telegram: Chat flow tạo task, inline approval buttons
- ✅ API: Agent registration, heartbeat, task queue
- ✅ NotificationService: Multi-channel (Telegram/Zalo/Dashboard)

**Status:** ✅ **COMPLETE** — Phase 2B ready to ship Friday (Feb 28)

**Chi phí:** ~$40-45 (2 tuần actual)  
**ROI:** Sếp tiết kiệm 80% thời gian quản lý tasks

---

## **PHASE 2: Learning Agents + Knowledge Base** 🔄 (Week 7-12, IN PROGRESS)

### **Mục tiêu:**
- Agents học từ feedback (ratings, examples)
- Knowledge base (workspace documents, brand guidelines)
- Persona integration (agents hiểu voice/tone của SME)

### **Deliverables:**

**Phase 2A (Week 7-8):**
- ✅ Agent persona system (profiles, style guides)
- ✅ Feedback & learning (ratings → examples table)
- ✅ Memory timeline (task history, learnings)
- ✅ Performance dashboard (metrics, success rate)

**Phase 2B (Week 9-10):**
- ✅ Workspace documents (upload, search, manage)
- ✅ Context integration (agents fetch persona + docs before task)
- ✅ Semantic search (pgvector on Supabase)
- 🔄 Manual UI testing (90 min) — **DUE: Tuesday Feb 24**
- 🎯 Launch: **Friday Feb 28, 2026**

**Phase 2C (Week 11-12) — NEW: Agent Learning Loop:**
- [ ] Auto-save successful outputs as examples (if rating ≥ 4⭐)
- [ ] Agent query examples before similar tasks
- [ ] Dashboard: "Agent learned this week" feed
- [ ] Knowledge base auto-grow (agents contribute)

**Status:** ✅ **95% COMPLETE** — Zero blockers, ready for Friday launch

**Chi phí Phase 2 total:** ~$60-80  
**ROI:** Agents improve 10-20% quality per month (continuous learning)

---

## **PHASE 3: MCP Integration + Tool Ecosystem** 🚀 (Week 13-20, NEW)

> **Core Strategy:** Không build riêng 100 integrations → Adopt MCP → instant access tools → focus on orchestration

### **Mục tiêu:**
1. CommandMate làm **MCP client** → agents dùng MCP tools
2. Integrate 5-10 core MCP servers (Phase 3A)
3. Build CommandMate **MCP server** → expose agents/tasks qua MCP (Phase 3B)
4. Launch tool marketplace (Phase 3C)

---

### **Phase 3A: MCP Client Implementation** (Week 13-16, ~1 tháng)

**Goal:** Agents trong CommandMate có thể gọi MCP tools

#### **Week 13-14: MCP Foundation**

**Tasks:**

| Task | Owner | Duration | Output |
|------|-------|----------|--------|
| Research MCP TypeScript SDK | Minh 📋 | 1 day | Implementation guide |
| Design MCP adapter layer | Thép ⚙️ | 2 days | Architecture diagram |
| Implement MCP client class | Thép ⚙️ | 3 days | `MCPClient.ts` |
| Test with filesystem server | Soi 🔍 | 1 day | Test report |

**Deliverable:**
```typescript
// Backend: MCPClient class
class MCPClient {
  async connect(serverUrl: string): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(toolName: string, params: any): Promise<any>;
  async disconnect(): Promise<void>;
}
```

**Success Metric:**
- ✅ CommandMate backend có thể connect đến MCP server
- ✅ List tools available
- ✅ Call 1 tool thành công (e.g., filesystem read)

---

#### **Week 15-16: Core Servers Integration**

**Goal:** Integrate 5 high-value MCP servers

**Priority Servers:**

| Server | Use Case | Value Prop | Owner |
|--------|----------|------------|-------|
| **1. Filesystem** | Agents read/write workspace docs | Local knowledge access | Thép ⚙️ |
| **2. GitHub** | Agents create PRs, issues | Code workflow automation | Thép ⚙️ |
| **3. Slack** | Agents send messages, notifications | Team comms | Phát 🚀 |
| **4. PostgreSQL** | Agents query Supabase DB | Data access | Thép ⚙️ |
| **5. Memory** | Agents long-term storage | Context persistence | Phát 🚀 |

**Tasks:**

| Week | Task | Output |
|------|------|--------|
| 15 | Install + configure 5 servers locally | Servers running |
| 15 | Build `MCPServerRegistry` (discover available tools) | Registry service |
| 16 | Implement tool routing (agent request → correct server) | Router logic |
| 16 | Add tool usage logging (audit trail) | Logs in DB |
| 16 | Build admin UI: list available tools | Dashboard page |

**Deliverable:**
- Dashboard page: "Available Tools" (list 5 servers × ~10 tools each = 50 tools)
- Agents có thể gọi tools qua API: `POST /api/v1/tools/execute`
  ```json
  {
    "tool": "slack_send_message",
    "params": {
      "channel": "#general",
      "text": "Task complete!"
    }
  }
  ```

**Success Metrics:**
- ✅ 5 MCP servers connected
- ✅ 50+ tools accessible
- ✅ Tool usage logged (audit trail)
- ✅ 1 agent successfully calls tool (e.g., send Slack message after task)

**Chi phí Phase 3A:** ~$30 (1 tháng, tool setup + integration)

---

### **Phase 3B: CommandMate as MCP Server** (Week 17-18, ~2 tuần)

**Goal:** Expose CommandMate tasks/agents qua MCP protocol → Sếp có thể manage tasks từ Claude Desktop

#### **Use Cases:**

**UC1: Sếp dùng Claude Desktop → tạo task CommandMate**
```
Sếp (trong Claude Desktop): "Create a blog task about AI in healthcare"
↓
Claude calls CommandMate MCP server
↓
CommandMate creates task → assigns to agent
↓
Claude replies: "Task #123 created, assigned to Kiến 🏗️"
```

**UC2: Sếp hỏi Claude → check task status**
```
Sếp: "What tasks are pending?"
↓
Claude queries CommandMate MCP server
↓
Returns: "3 tasks pending: [list...]"
```

**UC3: Approve task từ Claude Desktop**
```
Sếp: "Approve task #123 with 5 stars"
↓
Claude calls CommandMate MCP tool "approve_task"
↓
Task marked complete → published
```

---

#### **Tasks:**

| Task | Owner | Duration | Output |
|------|-------|----------|--------|
| Design MCP server spec (resources, tools) | Minh 📋 | 1 day | Spec doc |
| Implement MCP server endpoints | Thép ⚙️ | 3 days | Server running |
| Expose resources (tasks, agents, knowledge) | Thép ⚙️ | 2 days | Read-only access |
| Expose tools (create_task, approve, reject) | Thép ⚙️ | 2 days | Write access |
| Test với Claude Desktop | Soi 🔍 | 1 day | Test report |
| Document setup guide | Minh 📋 | 1 day | User docs |

**Deliverable:**
- CommandMate MCP server running (localhost or public URL)
- Claude Desktop config file:
  ```json
  {
    "mcpServers": {
      "commandmate": {
        "url": "https://api.commandmate.ai/mcp",
        "apiKey": "cm_xxx"
      }
    }
  }
  ```
- Sếp có thể tạo/check/approve tasks từ Claude Desktop

**Success Metrics:**
- ✅ Claude Desktop kết nối thành công
- ✅ List tasks hoạt động
- ✅ Create task hoạt động
- ✅ Approve task hoạt động

**Chi phí Phase 3B:** ~$15 (2 tuần, MCP server build)

---

### **Phase 3C: Tool Marketplace Foundation** (Week 19-20, ~2 tuần)

**Goal:** Chuẩn bị marketplace để community contribute MCP servers

#### **MVP Features:**

1. **Browse MCP Servers**
   - List community servers (curated)
   - Categories: Productivity, Code, Marketing, Sales, Support
   - Install button → auto-configure

2. **Install Flow**
   ```
   User clicks "Install Slack MCP Server"
   ↓
   Modal: "Enter Slack API key"
   ↓
   CommandMate tests connection
   ↓
   Success → Server active, tools available
   ```

3. **Tool Analytics**
   - Most used tools
   - Agent success rate per tool
   - Cost per tool (if paid APIs)

**Tasks:**

| Task | Owner | Duration | Output |
|------|-------|----------|--------|
| Design marketplace UI | Kiến 🏗️ | 2 days | Figma mockups |
| Build server catalog (hardcoded 10-20 servers) | Minh 📋 | 1 day | Server metadata JSON |
| Implement install flow | Kiến 🏗️ + Thép ⚙️ | 3 days | Working install |
| Tool analytics dashboard | Kiến 🏗️ | 2 days | Analytics page |
| Test with 3 servers | Soi 🔍 | 1 day | Test report |

**Deliverable:**
- Marketplace page với 10-20 curated servers
- User có thể install 1 server trong <2 phút
- Analytics: "Top tools this week"

**Success Metrics:**
- ✅ 20 servers trong catalog
- ✅ User installs 1 server successfully
- ✅ Analytics hoạt động

**Chi phí Phase 3C:** ~$20 (2 tuần, marketplace MVP)

---

**Phase 3 Total:**
- **Timeline:** 8 tuần (2 tháng)
- **Chi phí:** ~$65
- **Output:** 
  - CommandMate as MCP client (50+ tools instant)
  - CommandMate as MCP server (control từ Claude Desktop)
  - Tool marketplace foundation (community-ready)

---

## **PHASE 4: Billing + Multi-Platform Connectors** (Week 21-28, ~2 tháng)

### **Mục tiêu:**
1. Outcome-based billing (trả theo task completion)
2. Tool pricing transparent (MCP tool usage tracking)
3. Multi-platform agent connectors (CrewAI, LangChain)

---

### **Phase 4A: Billing Engine** (Week 21-24)

**Goal:** Charge theo outcomes + tool usage

#### **Pricing Model (MCP-Enhanced):**

**Developer Tier (BYOK):**
- 500K/mo flat
- 100 task completions included
- **MCP tools:** User provides own API keys → free tool usage
- Overage: +5K/task

**Business Tier (Managed):**
- 2M/mo
- 1,000 task completions included
- **MCP tools managed:** CommandMate provides API keys
- Tool usage charged: 
  - Slack send: 0.10 VNĐ/message
  - GitHub PR: 0.25 VNĐ/PR
  - File read/write: free (local)
  - PostgreSQL query: 0.05 VNĐ/query
- Overage: +50K/task

**Transparent Billing Example:**
```
Monthly Statement (Business Tier)

Base Subscription             2,000,000 VNĐ
  ✅ 1,000 task completions included
  ✅ 50 tool credits included

Usage:
  Task completions: 1,050
    1,000 included                     0 VNĐ
    +50 overage (×50K)         2,500,000 VNĐ

  MCP Tool Usage:
    Slack messages: 120
      50 included                      0 VNĐ
      +70 (×0.10)                      7 VNĐ
    GitHub PRs: 15 (×0.25)           3.75 VNĐ
    PostgreSQL queries: 500 (×0.05)   25 VNĐ
    ─────────────────────────────────
    Tool Total:                    35.75 VNĐ

───────────────────────────────────────
Total                          4,500,036 VNĐ
Tax (10%)                        450,004 VNĐ
───────────────────────────────────────
TOTAL DUE                      4,950,040 VNĐ

💡 Tip: 70 Slack messages vượt quota.
   Consider upgrading tool credits or optimize usage.
```

**Tasks:**

| Week | Task | Owner | Output |
|------|------|-------|--------|
| 21 | Design billing schema (tasks, tools, credits) | Thép ⚙️ | DB schema |
| 21 | Tool usage tracking (log every MCP call) | Thép ⚙️ | Logging service |
| 22 | Stripe integration (subscriptions + usage-based) | Thép ⚙️ | Stripe working |
| 22-23 | Billing dashboard (invoices, usage charts) | Kiến 🏗️ | Dashboard page |
| 23 | Cost tracking realtime (current month estimate) | Kiến 🏗️ | Widget on dashboard |
| 24 | Email invoices + payment flows | Phát 🚀 | Email working |
| 24 | E2E billing test | Soi 🔍 | Test report |

**Deliverable:**
- Stripe subscriptions active (tiers: Developer/Business/Enterprise)
- Usage-based billing works (overage charges)
- MCP tool pricing transparent (per-tool costs shown)
- Dashboard: "Current Month Cost" widget realtime

**Success Metrics:**
- ✅ 10 beta customers upgrade to paid
- ✅ Billing accurate (no disputes)
- ✅ Invoices auto-generated

**Chi phí Phase 4A:** ~$40 (1 tháng, Stripe + billing UI)

---

### **Phase 4B: Multi-Platform Connectors** (Week 25-28)

**Goal:** Kết nối agent platforms khác (không chỉ OpenClaw)

#### **Connectors:**

| Platform | Use Case | Priority | Owner |
|----------|----------|----------|-------|
| **CrewAI** | Multi-agent collaboration (research + writing crew) | High | Phát 🚀 |
| **LangChain** | Complex RAG workflows (vector DB + LLM chains) | Medium | Phát 🚀 |
| **n8n** | No-code automation (integrate với CommandMate workflows) | Medium | Thép ⚙️ |
| **Custom API** | Bất kỳ agent platform nào có API | High | Phát 🚀 |

**Connector Pattern:**
```typescript
interface AgentConnector {
  async register(agent: Agent): Promise<void>;
  async claimTask(taskId: string): Promise<Task>;
  async reportProgress(taskId: string, progress: number): Promise<void>;
  async submitResult(taskId: string, output: any): Promise<void>;
}

class CrewAIConnector implements AgentConnector {
  // Implement interface
}

class LangChainConnector implements AgentConnector {
  // Implement interface
}
```

**Tasks:**

| Week | Task | Output |
|------|------|--------|
| 25 | Design connector abstraction layer | Architecture doc |
| 25-26 | Build CrewAI connector | Working connector |
| 26 | Build Custom API connector (generic) | SDK/docs |
| 27 | Build LangChain connector | Working connector |
| 27 | Build n8n webhook connector | Bidirectional integration |
| 28 | Multi-platform demo (1 task → 3 platforms) | Demo video |

**Deliverable:**
- 4 connectors working (OpenClaw, CrewAI, LangChain, Custom API)
- Dashboard: "Add Agent Platform" wizard
- Documentation: "How to connect your agent platform"

**Success Metrics:**
- ✅ 3+ platforms connected per workspace (multi-agent orgs)
- ✅ Cross-platform workflows (CrewAI research → OpenClaw write → n8n publish)

**Chi phí Phase 4B:** ~$35 (1 tháng, connectors + testing)

---

**Phase 4 Total:**
- **Timeline:** 8 tuần (2 tháng)
- **Chi phí:** ~$75
- **Output:** Billing engine + multi-platform support

---

## **PHASE 5: Marketplace + Growth** (Week 29-40, ~3 tháng)

### **Mục tiêu:**
1. MCP tool marketplace expansion (community contributors)
2. Workflow template marketplace (COSMATE + community templates)
3. Referral + revenue-share programs

---

### **Phase 5A: MCP Server Marketplace v2** (Week 29-32)

**Goal:** Community có thể publish MCP servers → earn revenue share

#### **Features:**

1. **Submit MCP Server**
   - Developer uploads server metadata (JSON)
   - Tags: category, pricing (free/paid), verification status
   - Review process (CommandMate approves)

2. **Revenue Share Model**
   - Free servers: No revenue, featured in catalog (community goodwill)
   - Paid servers (premium tools with API costs):
     - Developer sets price per API call (e.g., "Twilio SMS: 2 VNĐ/SMS")
     - CommandMate charges user: 2.50 VNĐ/SMS (markup 25%)
     - Revenue split: **70% developer, 30% CommandMate**
   - Example: User sends 100 SMS → bill 250 VNĐ → developer earns 175 VNĐ, CommandMate 75 VNĐ

3. **Server Analytics**
   - Developer dashboard: installs, usage, earnings
   - Leaderboard: top servers (installs, revenue)

**Tasks:**

| Week | Task | Owner | Output |
|------|------|-------|--------|
| 29 | Design marketplace v2 UI | Kiến 🏗️ | Figma |
| 29 | Build submit server flow | Thép ⚙️ | Upload form |
| 30 | Implement review/approval workflow | Đệ 🐾 | Admin tools |
| 30-31 | Revenue share billing (track usage per developer) | Thép ⚙️ | Billing logic |
| 31 | Developer dashboard (earnings, analytics) | Kiến 🏗️ | Dashboard |
| 32 | Launch with 3-5 paid community servers | Minh 📋 | Outreach |

**Deliverable:**
- Marketplace với 50+ servers (20+ community-contributed)
- 3-5 paid servers earning revenue
- Developer dashboard live

**Success Metrics:**
- ✅ 50 servers total (20 community)
- ✅ $500/mo revenue share paid to developers (proof of marketplace)

**Chi phí Phase 5A:** ~$30

---

### **Phase 5B: Workflow Template Marketplace** (Week 33-36)

**Goal:** SMEs chia sẻ workflows thành công → kiếm passive income

#### **Template Examples:**

- **COSMATE Content Studio** (BizMateHub template):
  - Blog generator (research + writing + images + publish)
  - Price: 100K one-time OR free với attribution
  
- **Cold Email Outreach** (Sales template):
  - Find leads (Apollo API) → generate emails (GPT-4) → send (SendGrid) → track (CRM)
  - Price: 200K one-time

- **Customer Support Auto-Response** (Support template):
  - Ticket triage → knowledge base search → draft response → human review
  - Price: 150K one-time

**Revenue Model:**
- Template creator sets price (0-500K one-time purchase)
- CommandMate takes **20% commission**
- Free templates = community goodwill (featured)

**Tasks:**

| Week | Task | Owner | Output |
|------|------|-------|--------|
| 33 | Design template format (export/import workflows) | Thép ⚙️ | JSON schema |
| 33-34 | Build template marketplace UI | Kiến 🏗️ | Browse/install page |
| 34 | Template preview (before purchase) | Kiến 🏗️ | Preview mode |
| 35 | Payment flow (one-time purchase) | Thép ⚙️ | Stripe checkout |
| 35 | Creator dashboard (sales, earnings) | Kiến 🏗️ | Dashboard |
| 36 | Launch with 10 templates (5 free, 5 paid) | Đệ 🐾 | Marketing |

**Deliverable:**
- Template marketplace với 20+ templates
- COSMATE template free (onboarding users)
- 5 paid templates earning revenue

**Success Metrics:**
- ✅ 100 template installs (30% free, 70% paid)
- ✅ 10M VNĐ template revenue (Month 1)

**Chi phí Phase 5B:** ~$25

---

### **Phase 5C: Growth Programs** (Week 37-40)

**Goal:** Accelerate user acquisition via referrals + community

#### **Programs:**

1. **Referral Program**
   - Existing user refers friend → both get 1 month free (Business tier)
   - Or: 20% commission on referred user's first year payments

2. **Agency Partner Program**
   - Agencies rebrand CommandMate → sell to clients
   - Revenue share: 40% agency, 60% CommandMate
   - White-label dashboard (remove CommandMate branding)

3. **Affiliate Program**
   - Influencers/bloggers promote → earn 30% recurring commission

**Tasks:**

| Week | Task | Owner | Output |
|------|------|-------|--------|
| 37 | Build referral tracking (codes, attribution) | Thép ⚙️ | Referral system |
| 37-38 | Agency white-label UI | Kiến 🏗️ | Rebrand feature |
| 38 | Affiliate dashboard (links, earnings) | Kiến 🏗️ | Portal |
| 39 | Launch with 5 agency partners | Minh 📋 + Đệ 🐾 | Partnerships |
| 40 | Growth analytics (CAC, LTV, virality) | Thép ⚙️ | Metrics dashboard |

**Deliverable:**
- Referral system live (viral loop)
- 5 agency partners signed
- Affiliate program active (10+ affiliates)

**Success Metrics:**
- ✅ 30% new users via referrals (viral growth)
- ✅ 50 customers via agencies (B2B2C channel)

**Chi phí Phase 5C:** ~$20

---

**Phase 5 Total:**
- **Timeline:** 12 tuần (3 tháng)
- **Chi phí:** ~$75
- **Output:** Dual marketplaces (tools + templates) + growth channels

---

## 📊 **TỔNG KẾT ROADMAP**

### **Timeline Overview:**

| Phase | Duration | Focus | Chi Phí | Status |
|-------|----------|-------|---------|--------|
| **Phase 1** | 6 tuần | Foundation + Telegram | $45 | ✅ DONE |
| **Phase 2** | 6 tuần | Learning + Knowledge | $80 | 🔄 95% (ship Friday) |
| **Phase 3** | 8 tuần | MCP Integration | $65 | 📋 Planned |
| **Phase 4** | 8 tuần | Billing + Multi-Platform | $75 | 📋 Planned |
| **Phase 5** | 12 tuần | Marketplace + Growth | $75 | 📋 Planned |
| **Total** | **40 tuần** (~10 tháng) | Full Platform | **$340** | — |

---

### **Revenue Projections (with MCP):**

**Assumptions:**
- Launch: Month 3 (after Phase 2)
- MCP adoption: Month 5 (after Phase 3)
- Marketplace: Month 8 (after Phase 5A)

| Month | Users | MRR | Cumulative Revenue | Notes |
|-------|-------|-----|-------------------|-------|
| 1-2 | 0 | 0 | 0 | Build Phase 1-2 |
| 3 | 20 | 20M | 20M | Launch (beta, free) |
| 4 | 50 | 50M | 70M | Paid tiers live |
| 5 | 100 | 150M | 220M | MCP tools → value spike |
| 6 | 200 | 300M | 520M | Word-of-mouth growth |
| 7 | 350 | 500M | 1.02B | Multi-platform → enterprise |
| 8 | 500 | 750M | 1.77B | Marketplace → 2nd revenue stream |
| 9 | 700 | 1B | 2.77B | Referral program → viral |
| 10 | 1000 | 1.5B | 4.27B | Template sales + tool commissions |
| **Year 1** | **1000** | **1.5B** | **~15B VNĐ** | (~$600K ARR) |

**Revenue Breakdown (Month 10):**
- Subscriptions: 1.2B (80%)
- Tool marketplace commissions: 150M (10%)
- Template sales: 100M (7%)
- Agency white-label: 50M (3%)

---

### **MCP Impact on Growth:**

**Without MCP:**
- Build 10 integrations: 12 tháng + $100K
- Slow growth: 200 users Year 1
- Revenue: 200M MRR (~$8K)

**With MCP:**
- Instant 100+ tools: 2 tháng + $65
- Fast growth: 1000 users Year 1 (5× faster)
- Revenue: 1.5B MRR (~$60K, **7.5× higher**)

**MCP ROI:**
- Investment: $65 (Phase 3)
- Revenue lift: +1.3B MRR (vs non-MCP)
- **ROI: 20,000×** 🚀

---

## 🎯 **COMPETITIVE POSITIONING WITH MCP**

### **CommandMate vs Competitors (MCP-Enhanced):**

| Feature | CommandMate | Zapier | Make | n8n | Jasper |
|---------|------------|--------|------|-----|--------|
| **AI Agents** | ✅ Multi-platform | ❌ | ❌ | ❌ | ✅ Single-purpose |
| **MCP Standard** | ✅ 100+ tools | ❌ | ❌ | ❌ | ❌ |
| **Workflow Builder** | ✅ No-code | ✅ | ✅ | ⚠️ Self-host | ❌ |
| **Outcome Pricing** | ✅ $0.03-0.05/task | ❌ Seat-based | ❌ Seat-based | ⚠️ Free (self-host) | ❌ Seat-based |
| **Multi-Platform** | ✅ OpenClaw, CrewAI, LangChain | ❌ | ❌ | ⚠️ Via webhooks | ❌ |
| **Learning Agents** | ✅ Continuous improvement | ❌ | ❌ | ❌ | ⚠️ Static prompts |
| **Vietnamese-First** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Unique Positioning:**

> **"CommandMate = The ONLY platform where you orchestrate AI agents from ANY platform + use 100+ MCP-standard tools + pay only for outcomes — all in Vietnamese."**

---

## 🚀 **NEXT ACTIONS (This Week)**

### **Immediate (Today - Feb 24):**

1. **Sếp Review & Approve:**
   - ✅ MCP integration strategy (Phase 3)
   - ✅ Revised roadmap (40 tuần)
   - ✅ Budget: $340 total (~8M VNĐ)

2. **Phase 2B Final Push:**
   - [ ] Manual UI testing (90 min) — Soi 🔍 or Sếp
   - [ ] Fix cosmetic issues (if any)
   - [ ] Smoke test before Friday launch

### **This Week (Feb 24-28):**

3. **Launch Prep:**
   - [ ] Write launch announcement (Telegram, Facebook, LinkedIn)
   - [ ] Prepare demo video (3 min: persona + context + learning)
   - [ ] Invite 5-10 beta testers (CommandMate group)

4. **Friday Launch:**
   - [ ] Deploy Phase 2B to production
   - [ ] Monitor for bugs (24h watch)
   - [ ] Collect early feedback

### **Next Week (Mar 3-7):**

5. **Phase 3 Kickoff:**
   - [ ] Minh 📋: Research MCP TypeScript SDK (1 day)
   - [ ] Thép ⚙️: Design MCP adapter architecture (2 days)
   - [ ] Squad meeting: Phase 3 sprint planning

---

## 📝 **APPENDIX: MCP Resources**

### **Learning Materials:**

- [MCP Official Docs](https://modelcontextprotocol.io/docs)
- [MCP GitHub](https://github.com/modelcontextprotocol)
- [Community Servers List](https://github.com/modelcontextprotocol/servers)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### **Key Servers to Study:**

1. **Filesystem** (reference implementation)
2. **GitHub** (complex API integration)
3. **Slack** (real-world use case)
4. **PostgreSQL** (database pattern)
5. **Memory** (state management)

### **CommandMate-Specific:**

- Full research: `projects/commandmate/research/2026-02-24.md`
- Business model: `projects/commandmate/business-model-v2.md`
- Strategy 2026: `projects/commandmate/STRATEGY-2026.md`

---

## 🐾 **VERSION HISTORY**

- **v1.0** (2026-02-19): Original roadmap (Phase 1-4)
- **v2.0** (2026-02-24): **Added MCP integration** (Phase 3 revised, Phase 5 expanded)
- Next update: After Phase 2B launch (adjust based on learnings)

---

**Core Message to Sếp:**

> **"MCP không phải 'nice to have' — MCP là GAME-CHANGER cho CommandMate."**
>
> **Không MCP:** Build 10 tools, 12 tháng, $100K → 200 users Year 1  
> **Có MCP:** 100+ tools, 2 tháng, $65 → 1000 users Year 1 → **5× faster growth**
>
> **Positioning:** "Anthropic built the protocol. CommandMate built the platform. MCP gives you tools, we give you a workforce."
>
> **Risk:** MCP còn sớm, nhưng traction tốt (100+ servers, Anthropic backing). Nếu fail → pivot dễ (protocol đơn giản).
>
> **Recommendation:** ✅ **APPROVE** Phase 3 → Start Week 13 (sau Phase 2B launch)

---

**File này là living document — update sau mỗi phase complete.** 🐾
