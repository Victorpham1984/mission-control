# BizMate Business OS — Schema Design

**Version:** 0.1
**Ngày:** 2026-03-17
**Status:** 🟡 Draft — chờ review từ Sếp Victor

---

## Nguyên tắc thiết kế

1. **Lean schema** — 10-15 columns/table, dùng JSONB cho flexibility (tránh bloat kiểu Polsia 80+ columns)
2. **Soft delete** — companies dùng `deleted_at` thay vì hard delete (giữ analytics data)
3. **Reuse CommandMate tables** — auth (profiles), workspaces, agents, task_queue, MCP — giữ nguyên
4. **Bridge qua `workspace_id`** — companies link tới workspaces, không duplicate auth/billing logic
5. **RLS everywhere** — workspace-scoped isolation như CommandMate hiện tại
6. **Encrypt secrets** — integration tokens PHẢI encrypt bằng pgcrypto

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
  deleted_at TIMESTAMPTZ DEFAULT NULL, -- Soft delete: NULL = active, timestamp = deleted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)             -- MVP decision: 1:1 company per workspace. Multi-company = Phase 4+
);
```

**Indexes:** `workspace_id` (unique)
**RLS:** Workspace owner, filter `WHERE deleted_at IS NULL` trong tất cả queries
**Soft delete:** `deleted_at IS NULL` = active. Avoid data loss, giữ analytics khi user "xóa" company.

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
  -- Config schema finalized (see PlaybookConfig validation below)
  is_public BOOLEAN DEFAULT false,  -- Marketplace visibility
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:** `category`, `is_public`
**RLS:** Public read (is_public=true), author CRUD

#### `playbooks.config` — Finalized JSONB Schema

**Structure:**
```typescript
// Zod validation (to be implemented in src/lib/validations/playbook.ts)
import { z } from "zod";

const PlaybookStepSchema = z.object({
  order:             z.number().int().min(1),                      // REQUIRED: execution order
  action:            z.string().min(1),                            // REQUIRED: action identifier
  agent_skill:       z.string().min(1),                            // REQUIRED: maps to agent_skills.name
  trigger:           z.enum(["schedule", "webhook", "after_step_1", "after_step_2",
                             "after_step_3", "after_step_4", "after_step_5",
                             "after_step_6", "after_step_7"]),     // REQUIRED: when to execute
  requires_approval: z.boolean().default(false),                   // OPTIONAL: queue for CEO review
  config:            z.record(z.unknown()).default({}),             // OPTIONAL: step-specific overrides
});

const KpiTemplateSchema = z.object({
  name:     z.string().min(1),                                     // REQUIRED: KPI display name
  unit:     z.enum(["count", "VND", "%", "seconds"]),              // REQUIRED: measurement unit
  category: z.enum(["acquisition", "activation", "revenue", "operations"]), // REQUIRED: matches kpis.category
  target:   z.number().positive(),                                 // REQUIRED: default target value
});

const PlaybookConfigSchema = z.object({
  required_skills:  z.array(z.string().min(1)).min(1),             // REQUIRED: ≥1 skill
  default_agents:   z.number().int().min(1).max(10).default(2),    // OPTIONAL: agents to spawn (1-10)
  schedule:         z.string().min(1),                             // REQUIRED: cron expression
  report_schedule:  z.string().optional(),                         // OPTIONAL: separate cron for reports
  kpi_template:     z.array(KpiTemplateSchema).default([]),        // OPTIONAL: auto-create KPIs on install
  steps:            z.array(PlaybookStepSchema).min(1),            // REQUIRED: ≥1 step
});
```

**Validation rules:**
- `required_skills` phải có ít nhất 1 skill, mỗi skill map tới `agent_skills.name`
- `steps[].order` phải unique trong array, bắt đầu từ 1
- `steps[].agent_skill` phải nằm trong `required_skills`
- `steps[].trigger` dạng `after_step_N` → step N phải tồn tại
- `schedule` phải là cron expression hợp lệ (validate bằng `cron-parser`)
- `default_agents` max 10 cho MVP (tránh resource abuse)

**Reference implementation:** `docs/planning/bizmate/playbook-shopee-auto-order.md` — full 7-step config example.

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

**Indexes (performance-critical — heavy read/write table):**
```sql
CREATE INDEX idx_actions_company_created ON actions(company_id, created_at DESC);
CREATE INDEX idx_actions_type ON actions(company_id, action_type);
CREATE INDEX idx_actions_playbook ON actions(installed_playbook_id)
  WHERE installed_playbook_id IS NOT NULL;  -- Partial index: skip NULLs
CREATE INDEX idx_actions_task ON actions(task_id)
  WHERE task_id IS NOT NULL;
```
**RLS:** Workspace owner (via companies)

---

### 7. `integrations` — External platform connections (Phase 2+)

OAuth tokens cho Shopee, Lazada, TikTok Shop.

```sql
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,           -- 'shopee', 'lazada', 'tiktok', 'facebook', 'zalo_oa'
  access_token TEXT NOT NULL,       -- MUST encrypt: pgp_sym_encrypt(token, secret_key)
  refresh_token TEXT,               -- MUST encrypt: same as access_token
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

**Security — Token encryption (REQUIRED):**
```sql
-- Migration prerequisite:
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Write: encrypt before storing
INSERT INTO integrations (company_id, platform, access_token, refresh_token)
VALUES (
  $1, 'shopee',
  pgp_sym_encrypt($2, current_setting('app.encryption_key')),
  pgp_sym_encrypt($3, current_setting('app.encryption_key'))
);

-- Read: decrypt when reading
SELECT pgp_sym_decrypt(access_token::bytea, current_setting('app.encryption_key')) AS access_token
FROM integrations WHERE company_id = $1;
```
**Note:** `app.encryption_key` set via Supabase Dashboard → Settings → Database → Configuration. NEVER store in code.

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

## KPI Auto-Update Strategy

KPIs tự động cập nhật khi actions xảy ra. 2 cơ chế:

### 1. Trigger on actions INSERT (real-time)

```sql
-- Khi action mới được log → update KPI tương ứng
CREATE OR REPLACE FUNCTION public.update_kpi_from_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Update KPIs linked to this company where source = 'calculated'
  UPDATE public.kpis
  SET current_value = (
    SELECT COUNT(*) FROM public.actions
    WHERE company_id = NEW.company_id
      AND success = true
      AND action_type = kpis.name  -- KPI name maps to action_type
      AND created_at >= date_trunc('month', now())
  ),
  updated_at = now()
  WHERE company_id = NEW.company_id
    AND source = 'calculated';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_action_created_update_kpi
  AFTER INSERT ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.update_kpi_from_action();
```

### 2. Materialized view refresh (batch, mỗi 5 phút)

```sql
-- Dashboard summary view — refresh via pg_cron
CREATE MATERIALIZED VIEW public.company_kpi_summary AS
SELECT
  c.id AS company_id,
  COUNT(a.*) FILTER (WHERE a.success = true) AS total_successful_actions,
  COUNT(a.*) FILTER (WHERE a.created_at >= date_trunc('month', now())) AS actions_this_month,
  SUM(a.cost) FILTER (WHERE a.created_at >= date_trunc('month', now())) AS cost_this_month,
  AVG(a.duration_ms) FILTER (WHERE a.success = true) AS avg_duration_ms
FROM public.companies c
LEFT JOIN public.actions a ON a.company_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- Refresh every 5 minutes via pg_cron
SELECT cron.schedule('refresh-kpi-summary', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.company_kpi_summary');
```

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

1. [x] ~~`companies` 1:1 với `workspaces`~~ → **Resolved: 1:1 cho MVP.** Multi-company = Phase 4+. UNIQUE constraint confirmed.
2. [x] ~~`playbooks.config` structure~~ → **Resolved: Zod schema + validation rules finalized.** See PlaybookConfig section above. Reference: `playbook-shopee-auto-order.md`.
3. [ ] `integrations` — Shopee API access đã confirm chưa? OAuth flow nào? (blocked by Blocker 2 in BLOCKERS.md)
4. [ ] Billing: track ở `actions.cost` hay tạo bảng `billing_events` riêng?
5. [x] ~~KPI auto-update~~ → **Resolved: Trigger on actions INSERT (real-time) + materialized view refresh (5min cron).** See section above.
