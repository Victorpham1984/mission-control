# CommandMate — Strategy & Architecture 2026

> **Định vị: AI Agent Operations cho SME Việt Nam**
> "Không bán phần mềm. Bán kết quả mà agents tạo ra."

---

## I. BUSINESS MODEL EVOLUTION

### Từ đâu → Đến đâu

| | Hiện tại (v0) | Mục tiêu (v1-v2) |
|---|---|---|
| **Bán gì** | Dashboard xem agent | Platform vận hành agent |
| **Pricing** | Per seat/month | Per outcome (task, output, result) |
| **User chính** | Con người (founder/manager) | **Agents** (con người chỉ giám sát) |
| **Value** | Monitoring | **Execution + Data ownership** |
| **Moat** | Không có | Proprietary workflow data per SME |

---

### Pricing: Outcomes, Not Seats

**Triết lý:** SME không quan tâm có bao nhiêu agent — họ quan tâm bao nhiêu việc được xong.

```
FREE TIER (Starter)
├── 1 workspace
├── 3 agents
├── 100 task completions/month
├── Basic monitoring
└── Community support

PRO ($49/month base + usage)
├── Unlimited agents
├── 1,000 task completions included
├── $0.03 per additional completion
├── API access (agents tự report)
├── Custom workflows
├── Knowledge base 10GB
└── Priority support

TEAM ($149/month base + usage)
├── Everything Pro
├── 5,000 task completions included
├── $0.02 per additional completion
├── Multi-workspace
├── Team collaboration
├── Knowledge base 100GB
├── Audit logs + governance
└── Dedicated support
```

**"Task completion"** = 1 đơn vị đo lường:
- 1 bài content được tạo + duyệt = 1 completion
- 1 email campaign được gửi = 1 completion
- 1 data report được generate = 1 completion
- 1 customer inquiry được respond = 1 completion

→ **SME chỉ trả khi có output thực.** Không dùng = không tốn.

---

## II. SYSTEM ARCHITECTURE

### Tổng quan: 4 Layers

```
┌─────────────────────────────────────────────┐
│              HUMAN LAYER                     │
│   Dashboard · Approvals · Insights          │
│   (Con người giám sát, không thao tác)      │
├─────────────────────────────────────────────┤
│              AGENT LAYER                     │
│   Agent API · Task Queue · Skill Registry   │
│   (Agents tự nhận task, tự report, tự học)  │
├─────────────────────────────────────────────┤
│              DATA LAYER                      │
│   Knowledge Base · Workflow History          │
│   Templates · Performance Metrics           │
│   (System of Record — data thuộc về SME)    │
├─────────────────────────────────────────────┤
│              INFRA LAYER                     │
│   Auth · Billing · Monitoring · Governance  │
│   Audit Logs · Security · Rate Limiting     │
└─────────────────────────────────────────────┘
```

---

### Layer 1: AGENT LAYER (Core — build trước)

**Triết lý:** CommandMate là platform MÀ AGENTS SỬ DỤNG, không phải platform mà con người dùng để quản lý agents.

#### 1.1 Agent API (RESTful + WebSocket)

```
POST   /api/v1/agents/register          → Agent tự đăng ký vào workspace
POST   /api/v1/agents/:id/heartbeat     → Agent báo "tôi còn sống"
POST   /api/v1/agents/:id/status        → Agent cập nhật trạng thái

GET    /api/v1/tasks/available           → Agent hỏi "có task nào cho tôi?"
POST   /api/v1/tasks/:id/claim          → Agent nhận task
POST   /api/v1/tasks/:id/progress       → Agent báo tiến độ (0-100%)
POST   /api/v1/tasks/:id/complete       → Agent nộp kết quả
POST   /api/v1/tasks/:id/fail           → Agent báo lỗi

POST   /api/v1/knowledge/query          → Agent hỏi knowledge base
POST   /api/v1/knowledge/store          → Agent lưu kiến thức mới
POST   /api/v1/knowledge/learn          → Agent báo "tôi học được điều này"

WS     /api/v1/agents/:id/stream        → Realtime 2-chiều (task push, status)
```

**Tại sao quan trọng:** Hiện tại CommandMate chỉ **đọc** data từ agents (qua sync cron). Cần chuyển sang **agents chủ động giao tiếp** với CommandMate. Agent không cần biết dashboard tồn tại — nó chỉ cần API.

#### 1.2 Task Queue System

```
┌──────────┐    ┌──────────────┐    ┌──────────┐
│  Human   │───>│  Task Queue  │───>│  Agent   │
│ (create) │    │  (priority,  │    │ (claim + │
│          │<───│   matching)  │<───│ execute) │
│ (review) │    └──────────────┘    └──────────┘
```

- **Smart Assignment:** Task vào queue → match với agent có skill phù hợp → agent tự claim
- **Priority Levels:** urgent (agent nhận ngay) / normal (next available) / background (khi rảnh)
- **Auto-retry:** Task fail → queue lại → agent khác nhận
- **Human-in-the-loop:** Một số task cần approval trước khi complete

#### 1.3 Skill Registry

Mỗi agent đăng ký skills:
```json
{
  "agent_id": "kien-frontend",
  "skills": ["react", "nextjs", "tailwind", "responsive-design"],
  "capacity": 3,           // max concurrent tasks
  "availability": "24/7",  // hoặc schedule cụ thể
  "performance": {
    "avg_completion_time": "45m",
    "success_rate": 0.94,
    "quality_score": 4.2    // from human reviews
  }
}
```

→ Task queue dùng skill registry để **auto-assign đúng agent cho đúng task.**

---

### Layer 2: DATA LAYER (Moat — build song song)

**Triết lý:** "Agents đến rồi đi — data layer là forever." Mỗi SME trên CommandMate sở hữu 1 knowledge base riêng, không ai truy cập được trừ agents của họ.

#### 2.1 Knowledge Base per Workspace

```
workspace/
├── knowledge/
│   ├── brand/           → Brand voice, guidelines, colors
│   ├── products/        → Product catalog, specs, pricing
│   ├── customers/       → Customer segments, personas
│   ├── workflows/       → "Cách chúng tôi làm X" (SOPs)
│   ├── templates/       → Proven templates (content, email, ads)
│   └── learnings/       → Agent-generated insights
```

- **Vector search** (pgvector trên Supabase) → Agents query bằng ngôn ngữ tự nhiên
- **Versioned** → Mọi thay đổi đều có history
- **Agent-writable** → Agents tự bổ sung knowledge sau mỗi task
- **Human-reviewable** → Dashboard hiển thị "Agent vừa học điều này, bạn duyệt không?"

#### 2.2 Workflow History (System of Record)

Mỗi task completion = 1 record:
```json
{
  "task_id": "...",
  "type": "content_creation",
  "input": { "brief": "...", "channel": "facebook" },
  "output": { "content": "...", "images": [...] },
  "agent": "kien-frontend",
  "duration_ms": 180000,
  "quality_score": 4.5,
  "cost": 0.03,
  "learnings": ["Audience phản hồi tốt với format carousel"]
}
```

→ Theo thời gian, CommandMate **biết** cách SME đó hoạt động tốt nhất. Data này không thể thay thế bằng bất kỳ AI model nào.

#### 2.3 Template Marketplace (Phase 2+)

- SME tạo workflow hiệu quả → publish thành template
- SME khác mua/dùng template đó
- **CommandMate thu 20% commission**
- Win-win: SME kiếm passive income, platform thêm content

---

### Layer 3: HUMAN LAYER (Dashboard — đã có v0)

**Triết lý:** Con người KHÔNG cần thao tác hàng ngày. Dashboard là **cockpit giám sát**, không phải bảng điều khiển.

#### 3.1 Dashboard Evolution

```
v0 (hiện tại)              → v1 (target)
─────────────               ──────────────
Kanban board                Outcome dashboard
  "Task nào ở đâu"           "Hôm nay agents tạo được gì"
Agent list                  Agent performance
  "Ai online"                "Ai hiệu quả nhất"
Chat feed                   Approval queue
  "Agents nói gì"            "Cần tôi duyệt gì"
```

**Key screens v1:**
1. **Outcomes Today** — Số task hoàn thành, output tạo ra, tiết kiệm bao nhiêu giờ
2. **Approval Queue** — Tasks cần human review trước khi ship
3. **Agent Performance** — Success rate, speed, quality per agent
4. **Knowledge Feed** — "Agents vừa học được gì mới"
5. **Cost Tracker** — Spending vs outcomes (ROI realtime)

#### 3.2 Notification System

- **Urgent:** Agent gặp lỗi, task fail → push notification
- **Review:** Output cần duyệt → digest email 2x/ngày
- **Insight:** Agent phát hiện pattern → weekly report
- **Silent:** Mọi thứ khác → dashboard only

---

### Layer 4: INFRA LAYER (Build dần)

#### 4.1 Multi-Agent Connectors

CommandMate KHÔNG tự chạy agents — nó **kết nối** với agent platforms:

```
┌─────────────┐
│ CommandMate │
│   (Hub)     │
├─────────────┤
│ Connectors: │
│ ├── OpenClaw    ← Hiện tại đã có
│ ├── CrewAI      ← Phase 1
│ ├── AutoGen     ← Phase 2
│ ├── LangChain   ← Phase 2
│ ├── n8n         ← Phase 2 (workflow)
│ └── Custom API  ← Phase 1 (any agent)
└─────────────┘
```

**Tại sao:** SME sẽ dùng nhiều loại agent khác nhau. CommandMate là **lớp quản lý chung** — không lock-in vào 1 platform.

#### 4.2 Billing Engine

```
Monthly billing:
├── Base fee (plan tier)
├── + Task completions × unit price
├── + Knowledge storage (per GB over limit)
├── + API calls (per 1K over limit)
├── - Credits (from referrals, promos)
└── = Total invoice
```

#### 4.3 Governance & Audit

- **Audit log:** Mọi action đều được ghi (ai, làm gì, khi nào, kết quả)
- **Permissions:** Agent X chỉ được access knowledge folder Y
- **Rate limiting:** Agent không thể spam 1000 tasks/giây
- **Data residency:** Data SME ở đâu thì ở đó (quan trọng cho VN market)

---

## III. PHÂN PHA BUILD

### Phase 1: Agent API + Telegram-first Flow (6 tuần) — APPROVED ✅

**Nguyên tắc:** Telegram = điều khiển (80%), Dashboard = giám sát (20%)

**Flow:** Sếp nhắn Telegram → Đệ parse → tạo task qua API → Agent tự nhận → làm → nộp → Sếp duyệt trên Telegram (hoặc Dashboard cho phức tạp).

Chi tiết: xem `PHASE-1-PLAN.md`

**Deliverable:** Sếp nhắn Telegram giao việc → agent thật nhận task, làm, nộp → Sếp duyệt trên Telegram. Dashboard hiển thị tổng thể.

### Phase 2: Knowledge Layer (4-6 tuần)

| Task | Owner |
|------|-------|
| pgvector setup trên Supabase | Thép ⚙️ |
| Knowledge API (query, store, learn) | Thép ⚙️ |
| Knowledge Base UI (browse, review) | Kiến 🏗️ |
| Agent learning pipeline | Đệ 🐾 |
| Workflow history + analytics | Thép ⚙️ |
| Knowledge feed on dashboard | Kiến 🏗️ |

**Deliverable:** Agents query knowledge base khi làm task, tự bổ sung kiến thức, con người review trên dashboard.

### Phase 3: Billing + Connectors (4-6 tuần)

| Task | Owner |
|------|-------|
| Billing engine (outcome-based) | Thép ⚙️ |
| Stripe integration | Thép ⚙️ |
| CrewAI connector | Phát 🚀 |
| Custom API connector | Phát 🚀 |
| Usage dashboard + cost tracker | Kiến 🏗️ |
| Onboarding flow v2 | Kiến 🏗️ |

**Deliverable:** CommandMate có thể charge theo outcomes, kết nối nhiều loại agent platform.

### Phase 4: Marketplace + Growth (ongoing)

- Template marketplace
- Referral program
- White-label cho agencies
- Enterprise features (SSO, audit, compliance)

---

## IV. CẠNH TRANH & DIFFERENTIATION

### Ai đang build tương tự?

| Product | Focus | Khác CommandMate |
|---------|-------|-----------------|
| **CrewAI** | Agent framework | Dev tool, không có biz dashboard |
| **LangSmith** | LLM observability | Monitoring only, không có task mgmt |
| **AgentOps** | Agent analytics | US-focused, analytics chứ không phải operations |
| **Relevance AI** | No-code agents | Build agents, không quản lý cross-platform |

### CommandMate Differentiation:

1. **Agent-agnostic** — Không buộc dùng 1 framework. Kết nối bất kỳ agent nào có API
2. **Outcome-priced** — Trả theo kết quả, không theo seat. SME thấy ROI ngay
3. **Data ownership** — Knowledge base thuộc về SME, portable, không lock-in
4. **Vietnam-first** — UI tiếng Việt, hiểu quy trình SME Việt, hỗ trợ local
5. **Self-improving** — Agents tự học từ mỗi task → workspace càng dùng càng thông minh

---

## V. METRICS TO TRACK

### North Star: Monthly Task Completions (across all workspaces)

**Leading indicators:**
- Active agents per workspace
- Tasks created per day
- Knowledge base growth rate
- API calls per agent per day

**Business metrics:**
- MRR (Monthly Recurring Revenue)
- Revenue per workspace
- Churn rate
- Cost per task completion (our cost)
- LTV:CAC ratio

---

## VI. TÓM TẮT

> **CommandMate 2026 = Platform mà AI agents dùng để vận hành business cho SME.**
>
> Con người chỉ cần: (1) set up một lần, (2) duyệt output quan trọng, (3) xem báo cáo.
> Mọi thứ còn lại — agents lo.
>
> Data của mỗi SME là riêng, là vĩnh viễn, là moat.
> Agents có thể thay đổi. Platform có thể thay đổi. Data thì không.
