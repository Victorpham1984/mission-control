# 📋 CommandMate Mission Control — Tài liệu Dự án

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-02-17  
> **Production:** https://mission-control-sable-three.vercel.app  
> **GitHub:** github.com/Victorpham1984/mission-control

---

## 1. Tổng quan Dự án

### CommandMate là gì?

**CommandMate Mission Control** là nền tảng quản lý đội ngũ AI Agents — một "phòng điều hành" (dashboard) cho phép người dùng giám sát, giao việc, và điều phối nhiều AI agent cùng lúc từ một giao diện duy nhất.

### Mục đích

- **Trực quan hóa** hoạt động của đội AI agents trên Kanban board
- **Quản lý tác vụ** (tasks) với trạng thái, comments, và activity feed realtime
- **Giao tiếp** giữa các agents qua Squad Chat và Broadcast
- **Đồng bộ** dữ liệu từ OpenClaw Gateway vào Supabase để hiển thị trên web

### Tầm nhìn

Xây dựng một "Mission Control" hoàn chỉnh cho hệ sinh thái AI — nơi mà 1 người có thể điều hành một đội 6-10 AI agents như một team thực thụ, với workflow rõ ràng, lịch sử hoạt động đầy đủ, và khả năng mở rộng cho multi-user teams.

---

## 2. Kiến trúc Hệ thống

### Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript |
| **Styling** | Tailwind CSS, CSS Custom Properties (dark theme) |
| **Backend/DB** | Supabase (PostgreSQL + Auth + Realtime) |
| **Auth** | Supabase Auth (email/password + GitHub OAuth) |
| **Realtime** | Supabase Realtime (postgres_changes) |
| **Deployment** | Vercel (auto-deploy from GitHub) |
| **AI Platform** | OpenClaw (gateway, agents, sessions) |
| **Sync Scripts** | Node.js scripts (ESM) |

### Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────┐
│                   Browser (User)                 │
│           Next.js App (Vercel Edge)              │
│  ┌──────────┬──────────┬──────────┬───────────┐  │
│  │Dashboard │ Agents   │ Chat     │ Broadcast │  │
│  │(Kanban)  │ (Grid)   │ (Feed)   │ (Announce)│  │
│  └────┬─────┴────┬─────┴────┬─────┴─────┬─────┘  │
│       │          │          │           │         │
│       ▼          ▼          ▼           ▼         │
│  ┌─────────────────────────────────────────────┐  │
│  │       Supabase Client (@supabase/ssr)       │  │
│  │    Auth · Queries · Realtime Subscriptions  │  │
│  └──────────────────┬──────────────────────────┘  │
└─────────────────────┼─────────────────────────────┘
                      │ HTTPS / WebSocket
                      ▼
┌─────────────────────────────────────────────────┐
│              Supabase Cloud (Tokyo)              │
│  ┌──────────┬───────────┬────────────────────┐   │
│  │PostgreSQL│ Auth      │ Realtime           │   │
│  │  + RLS   │ (JWT)     │ (postgres_changes) │   │
│  └──────────┴───────────┴────────────────────┘   │
│  Project: ceioktxdsxvbagycrveh                   │
└──────────────────────┬───────────────────────────┘
                       ▲
                       │ Service Role Key
┌──────────────────────┴───────────────────────────┐
│           OpenClaw (Mac mini local)               │
│  ┌────────────────────────────────────────────┐   │
│  │ sync-to-supabase.mjs   (sessions → agents) │   │
│  │ import-transcripts.mjs (JSONL → messages)   │   │
│  └────────────────────────────────────────────┘   │
│  agents: Đệ, Kiến, Thép, Minh, Soi, Phát        │
└───────────────────────────────────────────────────┘
```

### Data Flow

1. **OpenClaw** quản lý AI agents (main + sub-agents), tạo sessions, xử lý tasks
2. **Sync scripts** chạy thủ công/cron: đọc sessions từ OpenClaw → upsert vào Supabase
3. **Next.js app** đọc data từ Supabase, hiển thị trên dashboard
4. **Realtime**: Supabase push updates qua WebSocket → UI auto-refresh
5. **User actions** (tạo task, di chuyển trạng thái, comment) → write trực tiếp vào Supabase

---

## 3. Database Schema

### Bảng chính

| Bảng | Mô tả | Quan hệ |
|------|--------|---------|
| `profiles` | User profiles (extends auth.users) | `id` → `auth.users.id` |
| `workspaces` | Workspace/tổ chức | `owner_id` → `profiles.id` |
| `workspace_members` | Thành viên workspace | → `workspaces`, `profiles` |
| `agents` | AI agents | → `workspaces` |
| `tasks` | Tác vụ/công việc | → `agents`, `workspaces` |
| `messages` | Tin nhắn (chat + broadcast) | → `agents`, `workspaces` |
| `task_comments` | Comments trên tasks | → `tasks`, `agents`, `workspaces` |

### Entity Relationship

```
profiles ──1:N──▶ workspaces
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       agents       tasks      messages
          │           │
          │           ▼
          └────▶ task_comments
```

### Bảng chi tiết

#### `profiles`
```sql
id          UUID PK (→ auth.users)
email       TEXT NOT NULL
full_name   TEXT NOT NULL
avatar_url  TEXT
timezone    TEXT DEFAULT 'UTC'
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

#### `workspaces`
```sql
id          UUID PK
name        TEXT NOT NULL
slug        TEXT UNIQUE NOT NULL
owner_id    UUID → profiles
plan        TEXT ('starter'|'pro'|'team')
settings    JSONB  -- gateway_url, gateway_token
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

#### `agents`
```sql
id            UUID PK
workspace_id  UUID → workspaces
name          TEXT NOT NULL
type          TEXT ('openclaw'|'crewai'|'custom')
description   TEXT
avatar_url    TEXT
status        TEXT ('online'|'offline'|'error'|'paused')
config        JSONB  -- role, badge, color, emoji, model, tokens
external_id   TEXT   -- OpenClaw session key
role          TEXT
about         TEXT
skills        TEXT[]
avatar_emoji  TEXT
last_seen_at  TIMESTAMPTZ
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

#### `tasks`
```sql
id              UUID PK
agent_id        UUID → agents
workspace_id    UUID → workspaces
status          TEXT ('pending'|'running'|'completed'|'failed')
input           JSONB  -- title, description, tags, kanban_status
output          JSONB
error           TEXT
duration_ms     INTEGER
cost_estimate   DECIMAL
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

#### `messages`
```sql
id            UUID PK
agent_id      UUID → agents
workspace_id  UUID → workspaces
direction     TEXT ('inbound'|'outbound')
content       TEXT NOT NULL
metadata      JSONB  -- source, priority, title
is_broadcast  BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ
```

#### `task_comments`
```sql
id            UUID PK
task_id       UUID → tasks
agent_id      UUID → agents
workspace_id  UUID → workspaces
content       TEXT NOT NULL
created_at    TIMESTAMPTZ
```

### RLS Policies

Tất cả bảng đều bật **Row Level Security (RLS)**:

| Bảng | Policy | Logic |
|------|--------|-------|
| `profiles` | View/Update/Insert own | `auth.uid() = id` |
| `workspaces` | Full CRUD | `auth.uid() = owner_id` |
| `workspace_members` | View own, Owner manages | `user_id` hoặc workspace owner |
| `agents` | Full CRUD | Qua workspace `owner_id = auth.uid()` |
| `tasks` | Full CRUD | Qua workspace `owner_id = auth.uid()` |
| `messages` | Full CRUD | Qua workspace `owner_id = auth.uid()` |

### Triggers

| Trigger | Khi nào | Hành động |
|---------|---------|-----------|
| `on_auth_user_created` | User signup | Auto-tạo profile trong `profiles` |
| `on_profile_created` | Profile mới | Auto-tạo default workspace |
| `update_*_updated_at` | UPDATE trên profiles/workspaces/agents | Set `updated_at = now()` |

### Realtime

Bật `REPLICA IDENTITY FULL` cho: `tasks`, `messages`, `agents` — cho phép subscribe postgres_changes qua WebSocket.

---

## 4. Tính năng Hiện tại

### 4.1 Dashboard (Trang chủ `/`)

**Kanban Board** là trung tâm của ứng dụng, gồm 5 cột:

| Cột | Màu | Mô tả |
|-----|-----|-------|
| Inbox | `#94a3b8` (xám) | Task mới tạo, chưa assign |
| Assigned | `#fb923c` (cam) | Đã giao cho agent |
| In Progress | `#60a5fa` (xanh dương) | Đang thực hiện |
| Review | `#a78bfa` (tím) | Cần review |
| Done | `#4ade80` (xanh lá) | Hoàn thành |

**Các thành phần:**

- **Agent Sidebar (trái)**: Danh sách agents với avatar, role, badge (Lead/Specialist/Integrator), status dot (working/idle/error). Click → mở Agent Profile Modal.
- **Kanban Columns (giữa)**: Task cards có title, mô tả, tags, agent assignment, timestamp. Click → mở Task Detail Modal. Có filter theo column và agent.
- **Live Feed (phải)**: Activity feed realtime — hiển thị mọi thay đổi (di chuyển task, tạo task, broadcast).
- **Header**: Logo, nav tabs (Dashboard/Agents/Settings), Chat/Broadcast buttons, New Task, user menu (avatar → settings/logout).
- **Empty State**: Khi workspace trống → hiển thị "Seed Sample Data" button.
- **Responsive**: Sidebar ẩn trên mobile (hamburger menu), Live Feed thành FAB button.

### 4.2 Authentication

**Login (`/login`)**
- Email + Password
- GitHub OAuth (redirect to `/auth/callback`)
- Link tới Signup

**Signup (`/signup`)**
- Full Name, Email, Password (min 6 chars)
- GitHub OAuth
- Sau signup → hiển thị "Check your email" confirmation
- Auto-tạo profile + default workspace qua triggers

**Onboarding (`/onboarding`)**
- Wizard 4 bước: Welcome → Workspace Name → Connect Gateway → Done
- Bước "Connect": nhập OpenClaw Gateway URL + API Token (có thể skip)
- Hoàn thành → lưu workspace settings + mark user `onboarded: true`

**Middleware**
- Supabase session middleware chạy trên mọi request (trừ static files)
- Quản lý auth cookies, refresh tokens

### 4.3 Agent Management (`/agents`)

**Grid View**: Hiển thị agents dạng card grid (1-3 columns responsive)
- Avatar emoji + name + status dot
- Role + Badge (Lead/Specialist/Integrator)
- Task count + active tasks
- Filter theo status: All/Working/Idle/Error

**Agent Profile Modal** (click vào agent):
- **Header**: Emoji, tên (editable inline), role (editable), status badge
- **About**: Mô tả ngắn (editable, click to edit)
- **Skills**: Tags (editable, comma-separated input)
- **3 Tabs**:
  - ⚠️ **Attention**: Pending tasks cần xử lý
  - 📋 **Timeline**: Tất cả tasks của agent
  - 💬 **Messages**: Chat history với agent (realtime subscription)
- **Message Input**: Gửi tin nhắn trực tiếp cho agent
- **Auto-save**: Mọi edit (name, role, about, skills) tự động lưu vào Supabase

**Auto-Name Generator** (`agent-names.ts`):
- Tạo identity cho agent theo role: frontend, backend, ba, qa, lead
- Mỗi role có pool tên Việt (ví dụ: "Linh Pixel", "Sơn Forge"), emoji, about, skills
- Tránh trùng tên với agents đã có

### 4.4 Task Management

**Task Card** (trên Kanban):
- Title, description (max 2 lines), tags, agent assignment, timestamp
- Click → mở Task Detail Modal

**Task Detail Modal**:
- Header: Title, status badge (màu theo column), agent info, timestamp
- Description + Tags
- **View Content**: Expandable — hiển thị `output/result` từ agent (JSON formatted)
- **Archive**: Đổi status → "completed" → đóng modal
- **Comments Section**: Realtime comments, hiển thị agent emoji + name + timestamp
- **Comment Input**: Gửi comment (assign cho agent đang phụ trách task)

**Create New Task**:
- Modal form: Title, Description, Assign to (dropdown agents), Tags (comma-separated)
- Tạo → insert vào Supabase → hiển thị trên Kanban + feed

**Status Flow** (Kanban ↔ Database):

```
UI Status        DB Status
─────────        ─────────
inbox       ←→   pending
assigned    ←→   pending   (kanban_status in input JSONB)
in-progress ←→   running
review      ←→   running
done        ←→   completed
```

### 4.5 Squad Chat (`/chat`)

- **Unified feed**: Tất cả messages từ mọi agents trong workspace
- **Realtime**: Subscribe `postgres_changes` INSERT trên table `messages`
- **Agent colors**: Mỗi agent có màu riêng từ palette 10 màu
- **Message grouping**: Tin nhắn liên tiếp từ cùng agent → gom header
- **Direction badges**: "outbound" tag cho tin gửi đi
- **Auto-scroll**: Tự cuộn xuống khi có tin mới
- **Send**: Gửi tin nhắn thay mặt agent đầu tiên (agent-to-agent communication)

### 4.6 Broadcast (`/broadcast`)

- **Broadcast Form**: Title (optional) + Message + Priority (Normal/High/Urgent)
- **Priority levels**:
  - 🔵 Normal: `bg-blue-500/20`
  - 🟡 High: `bg-amber-500/20`
  - 🔴 Urgent: `bg-red-500/20`
- **Gửi**: Insert 1 message per agent (is_broadcast=true) → tất cả agents nhận
- **History**: Danh sách broadcasts đã gửi, deduplicate theo content+timestamp, hiển thị số agents nhận
- **Format**: `[PRIORITY] Title: Message`

### 4.7 Settings (`/settings`)

- **Profile Section**: Display Name (editable), Email (readonly)
- **Workspace Section**: Workspace Name, OpenClaw Gateway URL, API Token
- **Danger Zone**: Delete Workspace (2-step confirm → xóa workspace + sign out)
- **Auto-save feedback**: "✓ Changes saved" toast

---

## 5. Squad — Đội ngũ AI Agents

CommandMate quản lý 6 AI agents chính, mỗi agent là một sub-agent của OpenClaw:

| # | Tên | Emoji | Role | Badge | External ID (session) | Mô tả |
|---|-----|-------|------|-------|-----------------------|-------|
| 1 | **Đệ** 🐾 | 🐾 | Main AI Assistant | Lead | `agent:main:main` | Agent chính — điều phối toàn bộ squad, giao việc, giám sát tiến độ |
| 2 | **Kiến** | 🤖 | Sprint 1 Developer | Specialist | `agent:main:subagent:4619e216...` | Xây dựng nền tảng ban đầu — schema, auth, dashboard MVP |
| 3 | **Thép** | 🤖 | Auth & Wiring | Specialist | `agent:main:subagent:bc695dce...` | Kết nối Supabase Auth, middleware, login/signup flow |
| 4 | **Minh** | 🤖 | Sprint 2 Developer | Specialist | `agent:main:subagent:951bfc77...` | Agent management, task detail, comments, chat |
| 5 | **Soi** | 🤖 | UI Overhaul | Specialist | `agent:main:subagent:c56be58a...` | Redesign toàn bộ UI — dark theme, responsive, animations |
| 6 | **Phát** | 🤖 | Sprint 3 Developer | Specialist | `agent:main:subagent:07dfe667...` | Broadcast, chat page, agent profiles, final polish |

### Agent Properties (trong DB)

Mỗi agent có thể được tùy chỉnh:
- **name**: Tên hiển thị (editable inline)
- **role**: Vai trò/chức danh
- **about**: Mô tả ngắn
- **skills**: Array string (e.g. `["React", "TypeScript", "Supabase"]`)
- **avatar_emoji**: Emoji đại diện
- **status**: online/offline/error/paused
- **config**: JSONB chứa badge, color, model, tokens, cost

---

## 6. Hệ thống Đồng bộ

### 6.1 Sync Sessions (`sync-to-supabase.mjs`)

**Mục đích**: Đồng bộ OpenClaw sessions → Supabase agents + tasks

**Flow**:
```
OpenClaw Sessions (JSON) → Script → Supabase
                                      ├── agents (upsert by external_id)
                                      └── tasks (upsert by agent_id)
```

**Cách chạy**:
```bash
node scripts/sync-to-supabase.mjs '<sessions_json>'
```

**Logic**:
- Đọc sessions từ argument JSON
- Main session (`agent:main:main`) → upsert agent "Đệ 🐾"
- Sub-sessions → upsert agents + tạo tasks
- Status mapping: recent (< 5 phút) → online, else offline
- Task status: `stop` → completed, recent → running, else → failed

### 6.2 Import Transcripts (`import-transcripts.mjs`)

**Mục đích**: Import lịch sử chat từ OpenClaw JSONL transcripts → Supabase messages

**Flow**:
```
~/.openclaw/agents/main/sessions/*.jsonl → Script → Supabase messages
```

**Logic**:
- Đọc `.jsonl` files từ sessions directory
- Map session IDs → agent external IDs (hardcoded mapping)
- Chỉ import sub-agent sessions (bỏ main — đó là chat user↔Đệ, không phải squad internal)
- Extract text content từ messages (skip system/tool noise)
- Truncate > 2000 chars
- Direction: `assistant` → outbound, else → inbound
- Batch insert 50 messages/lần
- Clear existing trước khi import (tránh duplicates)

### Kết nối Supabase

Cả 2 scripts dùng **Service Role Key** (bypass RLS):
- URL: `https://ceioktxdsxvbagycrveh.supabase.co`
- Region: ap-northeast-1 (Tokyo)

---

## 7. Deployment

### Git Workflow

```
feature branch → dev → staging → main → production (Vercel)
```

### URLs

| Môi trường | URL |
|------------|-----|
| **Production** | https://mission-control-sable-three.vercel.app |
| **GitHub** | github.com/Victorpham1984/mission-control |

### Vercel Config

- Auto-deploy từ `main` branch
- Framework: Next.js
- Build: `next build`
- Environment Variables cần set trên Vercel (xem mục 10)

### Supabase

- **Project ID**: `ceioktxdsxvbagycrveh`
- **Region**: ap-northeast-1 (Tokyo)
- **Dashboard**: https://supabase.com/dashboard/project/ceioktxdsxvbagycrveh

---

## 8. Cấu trúc Thư mục

```
mission-control/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── page.tsx                  # Dashboard (Kanban + sidebar + feed)
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # CSS custom properties (dark theme)
│   │   ├── login/page.tsx            # Login page
│   │   ├── signup/page.tsx           # Signup page
│   │   ├── onboarding/page.tsx       # Onboarding wizard
│   │   ├── agents/page.tsx           # Agent grid + profiles
│   │   ├── chat/page.tsx             # Squad Chat (full page)
│   │   ├── broadcast/page.tsx        # Broadcast announcements
│   │   ├── settings/page.tsx         # Profile & workspace settings
│   │   └── auth/callback/route.ts    # OAuth callback handler
│   │
│   ├── components/                   # Shared React components
│   │   ├── Header.tsx                # App header + nav
│   │   ├── AgentProfileModal.tsx     # Agent detail/edit modal
│   │   ├── TaskDetailModal.tsx       # Task detail + comments modal
│   │   ├── SquadChatModal.tsx        # Chat modal (dashboard overlay)
│   │   └── BroadcastModal.tsx        # Broadcast modal (dashboard overlay)
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── data.ts                   # UI types (Agent, Task, FeedItem, columns)
│   │   ├── agent-names.ts            # Auto-name generator
│   │   ├── chat-data.ts              # Initial chat messages (static)
│   │   └── supabase/                 # Supabase integration
│   │       ├── client.ts             # Browser Supabase client
│   │       ├── server.ts             # Server Supabase client
│   │       ├── middleware.ts         # Auth session middleware
│   │       ├── hooks.ts              # useWorkspaceData() hook + helpers
│   │       ├── types.ts              # TypeScript types matching DB
│   │       ├── schema.sql            # Full DB schema (DDL)
│   │       └── seed.ts              # Sample data seeder
│   │
│   └── middleware.ts                 # Next.js middleware (auth)
│
├── scripts/                          # (workspace scripts)
│   ├── sync-to-supabase.mjs         # OpenClaw → Supabase sync
│   └── import-transcripts.mjs        # JSONL → messages import
│
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 9. Roadmap

### ✅ Đã hoàn thành

#### Phase 0 — Foundation
- Database schema design (profiles, workspaces, agents, tasks, messages)
- Supabase project setup (Tokyo region)
- RLS policies + triggers (auto profile/workspace creation)
- TypeScript types matching schema

#### Sprint 1 — MVP Dashboard (Kiến)
- Kanban board 5 columns
- Agent sidebar
- Activity feed
- Task cards + create new task
- Sample data seeder

#### Sprint 2 — Auth & Real Features (Thép + Minh)
- Login/Signup (email + GitHub OAuth)
- Onboarding wizard (4 steps)
- Middleware auth protection
- Agent Profile Modal (editable name, role, about, skills)
- Task Detail Modal + comments (realtime)
- Supabase realtime subscriptions

#### Sprint 3 — Communication (Phát)
- Squad Chat page (full-page, realtime)
- Broadcast page (priority levels, history)
- Chat/Broadcast modals on dashboard
- Agent-to-agent messaging

#### UI Overhaul (Soi)
- Dark theme redesign
- Responsive mobile layout
- Animations (modal transitions, hover states)
- Component extraction (Header, modals)

#### Sync System
- `sync-to-supabase.mjs` — sessions → agents/tasks
- `import-transcripts.mjs` — JSONL → messages

### 🔜 Sắp tới

| Priority | Feature | Mô tả |
|----------|---------|-------|
| 🔴 High | **Realtime Agent Status** | Tự động cập nhật online/offline từ OpenClaw heartbeat |
| 🔴 High | **Cron Sync** | Tự động chạy sync scripts định kỳ (thay vì manual) |
| 🟡 Medium | **Drag & Drop Kanban** | Kéo thả task giữa các columns |
| 🟡 Medium | **Task Assignment** | Reassign task cho agent khác |
| 🟡 Medium | **Search & Filter** | Tìm kiếm tasks, messages theo keyword |
| 🟡 Medium | **Agent Auto-naming** | Tích hợp agent-names.ts vào flow tạo agent |
| 🟢 Low | **Multi-workspace** | Hỗ trợ nhiều workspaces per user |
| 🟢 Low | **Team Members** | Invite users vào workspace (workspace_members đã có schema) |
| 🟢 Low | **Notifications** | Push notifications cho urgent broadcasts |
| 🟢 Low | **Analytics** | Dashboard thống kê: tasks completed, agent performance, cost |
| 🟢 Low | **Subscriptions/Billing** | Stripe integration (types đã có: Subscription) |

---

## 10. Hướng dẫn Phát triển

### Prerequisites

- Node.js 18+
- npm hoặc yarn
- Supabase account (hoặc dùng project hiện tại)

### Setup Local

```bash
# Clone repo
git clone https://github.com/Victorpham1984/mission-control.git
cd mission-control

# Install dependencies
npm install

# Copy env
cp .env.example .env.local
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://ceioktxdsxvbagycrveh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Chỉ dùng cho sync scripts (KHÔNG đưa vào frontend)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

### Commands

```bash
# Development server
npm run dev          # http://localhost:3000

# Build
npm run build

# Lint
npm run lint

# Sync OpenClaw → Supabase (manual)
node scripts/sync-to-supabase.mjs '<sessions_json>'

# Import transcripts
node scripts/import-transcripts.mjs
```

### Database Setup (từ đầu)

1. Tạo Supabase project
2. Chạy `src/lib/supabase/schema.sql` trong SQL Editor
3. Thêm columns mới cho agents (nếu chưa có):
   ```sql
   ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT;
   ALTER TABLE agents ADD COLUMN IF NOT EXISTS about TEXT;
   ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills TEXT[];
   ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_emoji TEXT;
   ```
4. Tạo bảng `task_comments`:
   ```sql
   CREATE TABLE public.task_comments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
     agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
     workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
     content TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
   ```
5. Enable Realtime cho tables: agents, tasks, messages, task_comments
6. Set up Auth providers: Email + GitHub OAuth

### Coding Conventions

- **Client Components**: `"use client"` directive ở đầu file
- **State Management**: React hooks + Supabase realtime (không dùng Redux/Zustand)
- **Styling**: Tailwind + CSS custom properties cho theming
- **Types**: Strict TypeScript, types trong `lib/supabase/types.ts` và `lib/data.ts`
- **Modals**: Pattern: fixed overlay + centered card + `animate-modal` + click-outside-to-close

---

> 📝 **Ghi chú**: Tài liệu này được tạo tự động từ source code vào ngày 2026-02-17. Cập nhật khi có thay đổi lớn.
