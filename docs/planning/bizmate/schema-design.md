# BizMate Business OS — Schema Design

**Version:** 0.1
**Ngày:** 2026-03-17
**Status:** 🟡 Draft — chờ review từ Sếp Victor

---

## Nguyên tắc thiết kế

1. **Lean schema** — 10-15 columns/table, dùng JSONB cho flexibility (tránh bloat kiểu Polsia 80+ columns)
2. **Cascade deletes** — data integrity, xóa company → xóa hết data liên quan
3. **Reuse CommandMate tables** — auth (profiles), workspaces, agents, task_queue, MCP — giữ nguyên
4. **Bridge qua `workspace_id`** — companies link tới workspaces, không duplicate auth/billing logic
5. **RLS everywhere** — workspace-scoped isolation như CommandMate hiện tại

---

## ERD — Quan hệ giữa các bảng

```
                    ┌─────────────┐
                    │  profiles   │ (existing — auth.users)
                    └──────┬──────┘
                           │ owns
                    ┌──────▼──────┐
                    │ workspaces  │ (existing)
                    └──────┬──────┘
                           │ 1:1
                    ┌──────▼──────┐
              ┌─────┤  companies  ├─────┐─────────┐
              │     └──────┬──────┘     │         │
              │            │            │         │
        ┌─────▼────┐ ┌────▼─────┐ ┌────▼───┐ ┌───▼──────────┐
        │  goals   │ │   kpis   │ │actions │ │ integrations │
        └──────────┘ └──────────┘ └────────┘ └──────────────┘

        ┌──────────────┐     ┌─────────────────────┐
        │  playbooks   │────▶│ installed_playbooks  │
        │  (templates) │     │   (per company)      │
        └──────────────┘     └──────────────────────┘

  Existing CommandMate tables (không thay đổi):
  ┌─────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────┐
  │ agents  │ │ task_queue  │ │ mcp_servers │ │ workspace_   │
  │         │ │             │ │             │ │ documents    │
  └─────────┘ └────────────┘ └─────────────┘ └──────────────┘
```

---

## Bảng mới — Column definitions

### 1. `companies` — Business entity

Mỗi workspace có 1 company. Company là đơn vị kinh doanh mà CEO quản lý.

```sql
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,                    -- 'ecommerce', 'content', 'service', 'f&b', 'other'
  team_size TEXT,                   -- '1-5', '6-20', '21-50', '50+'
  icp_segment TEXT DEFAULT 'sme'   -- 'creator', 'sme', 'agency'
    CHECK (icp_segment IN ('creator', 'sme', 'agency')),
  currency TEXT DEFAULT 'VND',
  settings JSONB DEFAULT '{}',     -- timezone, language, preferences
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)             -- 1 company per workspace
);
```

**Indexes:** `workspace_id` (unique)
**RLS:** Workspace owner

---

### 2. `goals` — Business objectives

CEO đặt mục tiêu → agents thực hiện → system đo progress.

```sql
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,              -- "Đạt 100 đơn/tháng", "10K MRR"
  target_value DECIMAL NOT NULL,    -- 100, 10000
  current_value DECIMAL DEFAULT 0,  -- Auto-updated từ KPIs/actions
  unit TEXT NOT NULL,               -- 'orders', 'MRR', 'leads', 'posts', 'revenue'
  deadline DATE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:** `company_id`, `status`
**RLS:** Workspace owner (via companies → workspaces)

---

### 3. `kpis` — Key Performance Indicators

Metrics tự động track, linked tới goals.

```sql
CREATE TABLE public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,  -- optional link
  name TEXT NOT NULL,               -- "Đơn hàng/tháng", "Traffic", "Conversion rate"
  category TEXT NOT NULL
    CHECK (category IN ('acquisition', 'activation', 'revenue', 'operations')),
  current_value DECIMAL DEFAULT 0,
  target_value DECIMAL,
  unit TEXT NOT NULL,               -- 'count', 'VND', '%', 'seconds'
  source TEXT,                      -- 'shopee_api', 'manual', 'agent_report', 'calculated'
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:** `company_id`, `(company_id, category)`
**RLS:** Workspace owner (via companies)

---

### 4. `playbooks` — Workflow templates (global, shared)

Pre-built templates mà company install vào workspace. Tương tự "app store".

```sql
CREATE TABLE public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- "Shopee Auto-Fulfillment", "Blog Generator"
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('ecommerce', 'content', 'b2b', 'operations', 'marketing')),
  author_id UUID REFERENCES public.profiles(id),  -- NULL = system template
  config JSONB NOT NULL DEFAULT '{}',
  -- config structure:
  -- {
  --   "required_skills": ["content-writing", "seo"],
  --   "default_agents": 2,
  --   "schedule": "daily",
  --   "kpi_template": [{"name": "Posts/week", "unit": "count", "target": 5}],
  --   "steps": [
  --     {"order": 1, "action": "research", "agent_skill": "research"},
  --     {"order": 2, "action": "write", "agent_skill": "content-writing"},
  --     {"order": 3, "action": "review", "requires_approval": true}
  --   ]
  -- }
  is_public BOOLEAN DEFAULT false,  -- Marketplace visibility
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:** `category`, `is_public`
**RLS:** Public read (is_public=true), author CRUD

---

### 5. `installed_playbooks` — Company-specific instances

Company install playbook → customize → activate.

```sql
CREATE TABLE public.installed_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  customization JSONB DEFAULT '{}', -- Overrides cho config gốc
  active BOOLEAN DEFAULT true,
  schedule TEXT,                    -- Cron expression: "0 9 * * 1-5"
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, playbook_id)  -- 1 instance per playbook per company
);
```

**Indexes:** `company_id`, `(company_id, active)`
**RLS:** Workspace owner (via companies)

---

### 6. `actions` — Business operations log

Mỗi action = 1 outcome mà agent hoặc system thực hiện. Đây là basis cho outcome-based billing.

```sql
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  installed_playbook_id UUID REFERENCES public.installed_playbooks(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.task_queue(id) ON DELETE SET NULL,  -- Link tới CommandMate task
  action_type TEXT NOT NULL,        -- 'send_email', 'post_social', 'create_content', 'fulfill_order', 'update_crm'
  description TEXT,
  success BOOLEAN DEFAULT false,
  evidence JSONB DEFAULT '{}',     -- { screenshots: [], links: [], metrics: {} }
  cost DECIMAL DEFAULT 0,          -- Chi phí thực tế (LLM tokens, API calls)
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:** `company_id`, `(company_id, action_type)`, `(company_id, created_at DESC)`
**RLS:** Workspace owner (via companies)

---

### 7. `integrations` — External platform connections (Phase 2+)

OAuth tokens cho Shopee, Lazada, TikTok Shop.

```sql
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,           -- 'shopee', 'lazada', 'tiktok', 'facebook', 'zalo_oa'
  access_token TEXT NOT NULL,       -- Encrypted (Supabase Vault hoặc pgcrypto)
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  shop_id TEXT,                     -- Platform-specific shop/page ID
  metadata JSONB DEFAULT '{}',     -- Platform-specific config
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, platform)     -- 1 connection per platform per company
);
```

**Indexes:** `company_id`, `(company_id, platform)` (unique)
**RLS:** Workspace owner (via companies)
**Security:** access_token PHẢI encrypt. Dùng Supabase Vault hoặc pgcrypto `pgp_sym_encrypt`.

---

## Quan hệ với CommandMate tables hiện tại

| BizMate table | Liên kết tới | Cách liên kết |
|---------------|-------------|---------------|
| `companies` | `workspaces` | FK workspace_id (1:1) |
| `actions` | `task_queue` | FK task_id — mỗi action có thể link tới task |
| `playbooks.config` | `agent_skills` | Steps reference skill names mà agents đăng ký |
| `installed_playbooks` | `mcp_servers` | Playbook có thể trigger MCP tools |
| `kpis.source` | `actions` | KPIs auto-calculated từ action logs |

**Không thay đổi tables hiện tại.** BizMate layer build ON TOP OF CommandMate.

---

## Migration plan

```
Phase 1: companies + goals + kpis (CEO dashboard cơ bản)
Phase 2: playbooks + installed_playbooks + actions (automation engine)
Phase 3: integrations (Shopee/Lazada connection)
```

Mỗi phase = 1 migration file trong `supabase/migrations/`.

---

## Open Questions

1. [ ] `companies` 1:1 với `workspaces` — hay cho phép 1 workspace có nhiều companies?
2. [ ] `playbooks.config` structure — cần finalize steps schema
3. [ ] `integrations` — Shopee API access đã confirm chưa? OAuth flow nào?
4. [ ] Billing: track ở `actions.cost` hay tạo bảng `billing_events` riêng?
5. [ ] KPI auto-update: trigger, cron job, hay calculated view?
