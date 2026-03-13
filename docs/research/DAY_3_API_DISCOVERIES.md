# Day 3: API Endpoint Discovery & Schema Mapping

**Date:** March 6, 2026  
**Researcher:** Agent Phát  
**Focus:** API Inventory, Integration Endpoints, Agent System Prompts

---

## 🎯 Executive Summary

Tested **31 API endpoints**, discovered **7 working endpoints**, and captured critical schemas including:
- Full **Chat Agent system prompt** (2000+ words of implementation details)
- **Subscription tier structure** (Stripe integration)
- **Integration status APIs** (Twitter, Ads, Outreach)
- **Pricing model complete** (task credits, company tiers)

**Major Finding:** Polsia exposes full agent prompts via API → Complete reverse-engineering of agent behavior possible.

---

## 📊 API Endpoint Inventory

### ✅ Working Endpoints (7)

| Endpoint | Method | Purpose | Key Findings |
|----------|--------|---------|--------------|
| `/api/companies/:id` | GET | Get company details | 80+ fields (Day 2 discovery) |
| `/api/agents/:id` | GET | Get agent details | **Full system prompt exposed** |
| `/api/user/settings` | GET | User settings | `company_name`, `company_slug`, `public_dashboard_enabled` |
| `/api/companies/:id/twitter/status` | GET | Twitter integration | `active`, `paused`, `frequency`, `recurringTaskId` |
| `/api/companies/:id/ads/status` | GET | Facebook Ads status | `enabled`, `dailyBudget`, `campaignId`, `adsetId`, `todaySpend` |
| `/api/companies/:id/outreach/status` | GET | Outreach status | `active`, `paused`, `frequency`, `recurringTaskId` |
| `/api/subscription` | GET | Subscription details | **Full pricing tiers**, Stripe IDs |

### ❌ Non-Existent Endpoints (24)

**Documents/Links:**
- `/api/companies/:id/documents` ❌
- `/api/companies/:id/links` ❌

**Tasks/Cycles:**
- `/api/companies/:id/tasks` ❌
- `/api/companies/:id/cycle` ❌
- `/api/companies/:id/cycles` ❌

**Conversations:**
- `/api/conversations/:id` ❌
- `/api/conversations/:id/messages` ❌

**Executions:**
- `/api/executions/:id` ❌

**User/Auth:**
- `/api/me` ❌
- `/api/session` ❌

**Dashboard:**
- `/api/companies/:id/dashboard` ❌
- `/api/companies/:id/activity` ❌

**Billing:**
- `/api/billing` ❌

**Conclusion:** Polsia's API surface is **smaller than expected**. Many features likely work through:
1. **SSE (Server-Sent Events)** for real-time updates
2. **GraphQL** instead of REST
3. **Frontend state management** (cached from initial sync)

---

## 🤖 Chat Agent System Prompt (COMPLETE)

### Agent Schema

```json
{
  "id": 38,
  "user_id": null,
  "name": "Chat",
  "description": "Your personal AI assistant for conversations...",
  "role": "You are Polsia, running {{company_name}}...",
  "agent_type": "chat",
  "status": "active",
  "config": {
    "maxTurns": 200,
    "strategy": "llm",
    "mcpMounts": ["chat", "memory", "skills"],
    "postHooks": [],
    "promptInjections": [
      {"type": "agent_memory"},
      {"type": "execution_context"}
    ]
  },
  "is_global": true,
  "agent_classification": "one_off",
  "expertise": "Conversational AI, inbox management...",
  "created_at": "2025-12-15T13:39:31.420Z",
  "updated_at": "2026-03-06T02:11:48.054Z"
}
```

### System Prompt Highlights (2000+ words)

**Identity:**
> "You are Polsia, running {{company_name}}. Casual coworker, not consultant. **1-2 sentences max** unless asked for more."

**Task Clarity (Critical Insight):**
> "You're a **cofounder, not an order taker.** Before creating a task, ask: 'Could two different agents interpret this differently?' If yes, the task isn't ready."

> "When the user is vague, don't guess — **offer options.**"

**Available Tools:**
- `get_context()` - Company info, infrastructure status
- `get_tasks()` - Check for duplicate tasks
- `find_best_agent()` - Search historical outcomes to recommend agent
- `create_task()` - Create new task
- `report_bug()` - User-reported issues
- `suggest_feature()` - New capabilities

**Task Tags:**
- `engineering` (code)
- `browser` (click/fill websites)
- `research` (read-only web)
- `growth` (marketing)
- `data` (analytics)
- `support` (customer)
- `meta_ads` (ad campaigns)

**Bug vs Feature Classification:**
> "BUG = something BROKE or doesn't work AS DESIGNED. FEATURE = something NEW."

> "You don't have access to code, so NEVER guess root causes. Describe **symptoms only**."

**Capabilities:**
- Web apps (GitHub + Render + Postgres)
- Browser automation
- Twitter @polsia (1/day limit)
- **Meta Ads** (fully managed video ad campaigns, $10-1000/day)

**Payments (Critical Business Logic):**
> "**Stripe is built into Polsia.** Users do NOT need their own Stripe account or keys. NEVER create tasks for custom Stripe integration, Stripe key setup, or connecting Stripe."

> "Polsia handles payments — your customers pay through your app and the money goes to your Polsia balance. You can withdraw anytime from Settings."

**Platform Details:**
- **Tech stack:** Render (hosting), Neon (Postgres), GitHub (code), R2 (media)
- **Emails:** 2/day outbound via company inbox. Users connect their own Gmail for more.
- **Browser limits:** HackerNews/Medium/Dev.to posts require manual account setup (CAPTCHA blocks)

**Recurring Tasks:**
- Frequencies: daily, weekdays, weekly, monthly
- Tools: `get_recurring_tasks()`, `create_recurring_task()`, `update_recurring_task()`, `delete_recurring_task()`
- Each run consumes 1 task credit

**Memory System:**
> "Your conversation history is automatically saved to shared company memory every 20 messages. All agents (CEO, Engineering, Twitter) read this same memory — they know what you know."

**Tone:**
> "**KEEP IT SHORT. 1-2 SENTENCES. NO BULLET LISTS. NO HEADERS. JUST TALK.**"

---

## 💰 Pricing Model (COMPLETE)

### Subscription Schema

```json
{
  "success": true,
  "subscription_id": "sub_1T7H5KEnJ6RDKGnKBjG8gEDA",
  "customer_id": "cus_U5Rj4DOG7dUaKV",
  "status": "trialing",
  "plan_tier": "standard",
  "total_monthly": 49,
  "companies": [
    {
      "id": 13563,
      "name": "RunHive",
      "slug": "runhive",
      "monthly_budget": 49,
      "plan_tier": "standard"
    }
  ]
}
```

### Pricing Tiers (from Agent Prompt)

**Base Plan: $49/mo**
- 1 company
- 30 night shifts (1/day autonomous cycles)
- 5 task credits
- Unlimited chat

**Extra Companies:**
- $49/mo per additional company

**Task Credit Tiers:**
- 15 credits: $19/mo
- 25 credits: $29/mo
- 50 credits: $49/mo
- 100 credits: $99/mo
- 200 credits: $199/mo
- 500 credits: $499/mo
- 1000 credits: $999/mo

**Free Trial:**
- 3 days free
- Then $49/mo

**Comparison (from prompt):**
> "Compare to lattes, Netflix, or $8k/mo junior devs."

---

## 🔌 Integration Status APIs

### Twitter Integration

**Endpoint:** `GET /api/companies/:id/twitter/status`

```json
{
  "success": true,
  "active": false,
  "paused": false,
  "frequency": null,
  "recurringTaskId": null
}
```

**Capabilities:**
- Post tweets (1/day limit)
- Managed via recurring tasks
- Can be paused/resumed

### Facebook Ads Integration

**Endpoint:** `GET /api/companies/:id/ads/status`

```json
{
  "success": true,
  "ads": {
    "enabled": false,
    "dailyBudget": 0,
    "campaignId": null,
    "adsetId": null,
    "todaySpend": 0
  }
}
```

**Capabilities:**
- Fully managed video ad campaigns
- Budget range: $10-1000/day
- Tracks daily spend
- Campaign/Adset management via Meta API

### Outreach Integration

**Endpoint:** `GET /api/companies/:id/outreach/status`

```json
{
  "success": true,
  "active": false,
  "paused": false,
  "frequency": null,
  "recurringTaskId": null
}
```

**Capabilities:**
- Cold outreach campaigns
- 2/day email limit via company inbox
- Users can connect Gmail for more

---

## 🏗️ Infrastructure Insights (from Agent Prompt)

### Tech Stack Confirmed

| Component | Technology | Source |
|-----------|-----------|--------|
| **Hosting** | Render.com | Agent prompt + headers |
| **Database** | Neon (Postgres) | Agent prompt (Neon = serverless PostgreSQL) |
| **Code** | GitHub | Agent prompt |
| **Media Storage** | Cloudflare R2 | Agent prompt (S3-compatible) |
| **Payments** | Stripe | Subscription API + prompt |
| **Backend** | Node.js + Express | Day 2 headers |

**Why Neon Postgres?**
- Serverless (auto-scales, pay-per-use)
- Branching (database branches like Git)
- Render.com integration
- Cheaper than RDS/Cloud SQL

**Why Cloudflare R2?**
- S3-compatible
- No egress fees (major cost savings vs S3)
- Integrated with Cloudflare CDN

---

## 🔧 Agent Configuration System

### Config Schema

```json
{
  "maxTurns": 200,
  "strategy": "llm",
  "mcpMounts": ["chat", "memory", "skills"],
  "postHooks": [],
  "promptInjections": [
    {"type": "agent_memory"},
    {"type": "execution_context"}
  ]
}
```

**Key Fields:**
- `maxTurns: 200` → Conversation limit per agent execution
- `strategy: "llm"` → LLM-based (vs rule-based)
- `mcpMounts` → MCP (Model Context Protocol) mounts for tools
- `promptInjections` → Dynamic context added to system prompt

### MCP Mounts (Tool Access)

1. **`chat`** → Conversation history, send messages
2. **`memory`** → Company memory, update context
3. **`skills`** → Tool library (create_task, get_context, etc.)

### Prompt Injections

1. **`agent_memory`** → Recent conversation history
2. **`execution_context`** → Current date, company name, etc.

**Example Injection:**
```
Company: {{company_name}} | Today: {{current_date}}
```

---

## 🎯 Key Insights

### 1. **Agent Prompts Are Public**

**Finding:** Full system prompts exposed via `/api/agents/:id`

**Implications:**
- Complete reverse-engineering of agent behavior possible
- Competitor analysis trivial (can see exact prompts)
- Security risk (exposes business logic, limitations)

**BizMate Strategy:**
- Don't expose full prompts via API
- Use prompt versioning/hashing
- Restrict to authenticated users only

### 2. **Task Credit Economy**

**Pricing Structure:**
- Base: 5 credits/mo ($49)
- Scales to 1000 credits/mo ($999)
- Recurring tasks consume 1 credit per run

**Economics:**
- $49/mo ÷ 50 tasks = **$0.98 per task**
- $999/mo ÷ 1000 tasks = **$0.999 per task** (no volume discount!)

**Comparison:**
- Zapier: $0.10-0.30 per task (cheaper)
- Make.com: $0.09-0.18 per task (cheaper)
- Polsia's value = **AI autonomy**, not just automation

### 3. **Neon Postgres = Serverless**

**Why This Matters:**
- Auto-scales with usage
- Pay-per-use (no idle server costs)
- Database branching (test on separate branch)
- Cheaper than RDS at low scale

**BizMate Consideration:**
- Neon good for early stage
- Migrate to managed PostgreSQL at scale (Supabase, Render Postgres)

### 4. **Cloudflare R2 = S3 Without Egress Fees**

**Cost Savings:**
- AWS S3: $0.09/GB egress (expensive for media-heavy apps)
- Cloudflare R2: $0 egress (only storage cost)

**Example:**
- 100GB images, 10TB/mo bandwidth
- S3: $9/mo storage + $900/mo egress = **$909/mo**
- R2: $1.50/mo storage + $0 egress = **$1.50/mo**

**BizMate Strategy:** Use R2 for all media storage.

### 5. **Stripe-as-a-Service Model**

**Polsia's Approach:**
> "Users do NOT need their own Stripe account or keys."

**How It Works:**
1. Polsia has master Stripe account
2. User's customers pay via Polsia's Stripe
3. Money goes to user's "Polsia balance"
4. User withdraws to bank

**Implications:**
- Polsia takes payment processing fee
- Simpler onboarding (no Stripe setup)
- Lock-in (money held in Polsia ecosystem)

**BizMate Alternative:**
- Let users connect **their own Stripe** (Stripe Connect)
- More complex setup, but:
  - Money goes directly to user
  - No Polsia lock-in
  - Better for agencies/freelancers

### 6. **Memory Sync Every 20 Messages**

**Polsia's Memory System:**
> "Conversation history is automatically saved to shared company memory every 20 messages."

> "All agents (CEO, Engineering, Twitter) read this same memory — they know what you know."

**Architecture:**
- Shared memory across all agents
- Auto-sync every 20 messages
- No user action required

**BizMate Opportunity:**
- Make memory system **explicit and transparent**
- Let users **view/edit** company memory
- **Tag memories** (project X, client Y)
- **Search memories** (full-text search)

---

## 🚧 API Gaps & Inferences

### Missing Endpoints (Likely SSE-Based)

**Documents & Links:**
- Not available via REST API
- Likely sent via SSE `sync` message (Day 1 discovery)

**Tasks:**
- No `/api/tasks` endpoint found
- Agent prompt mentions `get_tasks()` tool → Internal API only

**Conversations/Messages:**
- Not exposed via REST
- Real-time via SSE `group_chat_message` events

**Executions:**
- No REST endpoint
- Real-time via SSE `agent_started`, `execution_log` events

**Cycles:**
- No REST endpoint
- Status sent via SSE `sync` message (`cycleRunning`, `cyclePaused`, etc.)

### Conclusion: Polsia is SSE-First, Not REST-First

**Architecture:**
1. **Initial Load:** Single `/api/companies` call (all data in one response)
2. **Real-Time Updates:** SSE stream (`/api/executions/stream`)
3. **Rare REST Calls:** Integration status, subscription, user settings

**Benefits:**
- Fewer HTTP requests
- Real-time updates (no polling)
- Simpler backend (less REST boilerplate)

**Trade-offs:**
- Harder to debug (SSE is one-way)
- Can't paginate (all data in initial sync)
- Client-side state complexity

**BizMate Strategy:**
- Hybrid approach: REST for CRUD, SSE for real-time
- Pagination for large datasets
- GraphQL for flexible queries

---

## 📊 Day 3 Deliverables

1. ✅ **API endpoint inventory** (31 endpoints tested, 7 working)
2. ✅ **Full Chat Agent system prompt** (2000+ words)
3. ✅ **Complete pricing model** (base $49, task credits $19-$999)
4. ✅ **Integration status schemas** (Twitter, Ads, Outreach)
5. ✅ **Subscription schema** (Stripe integration, plan tiers)
6. ✅ **Infrastructure stack** (Neon Postgres, Cloudflare R2)
7. ✅ **Agent configuration system** (MCP mounts, prompt injections)
8. ✅ **Memory system documentation** (20-message sync, shared memory)

---

## ⏭️ Day 4-5 Plan

**Day 4: SSE Deep Dive**
- Connect to `/api/executions/stream`
- Capture all SSE message types
- Document sync message format
- Map SSE event flows (task creation → execution → completion)

**Day 5: Infrastructure & Security Audit**
- Check security headers (CSP, HSTS, X-Frame-Options)
- Test input validation
- Analyze error messages for info leakage
- Document CI/CD patterns (if visible)
- Check for GraphQL endpoint

---

**Status:** Day 3 Complete ✅  
**Overall Progress:** 21% (3/14 days)  
**Timeline:** Ahead of schedule 🟢  
**Budget Used:** $0  
**Token Estimate:** ~60K (Days 1-3 combined)
