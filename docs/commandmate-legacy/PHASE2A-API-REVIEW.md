# Phase 2A API Readiness Review
**Agent Auto-Execution + Telegram Notifications**

**Reviewer:** Minh 📋  
**Date:** 2026-02-21  
**Repo:** `/tmp/mc-check`

---

## 1. Task Lifecycle Endpoints

### ✅ `/api/v1/tasks/:taskId/claim` (POST)
**Status:** Sẵn sàng cho auto-execution

**Current Implementation:**
- **Body:** `{ agent_id: string }` ✅
- **Response:** `{ task_id, status: "in-progress", claimed_by, claimed_at }` ✅
- **Logic:** Atomic claim với condition `status = 'queued'` → prevents race conditions ✅
- **Validation:** Agent thuộc workspace, task chưa bị claim ✅

**Auto-execution Ready:** ✅ YES
- Agent SDK có thể poll `/api/v1/tasks/available` và claim ngay


---

### ✅ `/api/v1/tasks/:taskId/progress` (POST)
**Status:** Sẵn sàng

**Current Implementation:**
- **Body:** `{ agent_id, progress_percent: number, status_message?: string }` ✅
- **Validation:** 
  - `progress_percent` must be 0-100 ✅
  - Chỉ assigned agent mới report được ✅
- **Updates:** `progress_percent`, `status_message`, `updated_at` ✅

**Auto-execution Ready:** ✅ YES
- Agent có thể stream progress updates
- Frontend có thể realtime subscribe (Supabase realtime enabled)


---

### ⚠️ `/api/v1/tasks/:taskId/complete` (POST)
**Status:** Cần sửa nhỏ cho Phase 2A

**Current Implementation:**
- **Body:** `{ agent_id, output?: object, duration_ms?: number }` ✅
- **Response:** `{ task_id, status, approval_queue_position?, notification_sent: false }`
- **Logic:**
  - Auto-detect `needs_approval` → status `pending-approval` or `completed` ✅
  - Auto-calculate `duration_ms` nếu không có ✅
  - Set `progress_percent = 100` ✅

**⚠️ Issue:**
- Response field `notification_sent: false` is **hardcoded** — không có notification logic thực tế
- Không có trigger/webhook để notify user khi task complete

**Recommended Actions:**
1. Add notification service integration trong `/complete` endpoint
2. Hoặc tạo database trigger/webhook khi `status = 'completed'` hoặc `'pending-approval'`
3. Store notification delivery status trong DB


---

### ✅ `/api/v1/tasks/:taskId/fail` (POST)
**Status:** Sẵn sàng

**Current Implementation:**
- **Body:** `{ agent_id?, error?: string }` ✅
- **Response:** `{ task_id, status, action, retry_count, max_retries: 3, fail_count }` ✅
- **Retry Logic:** 
  - Auto-retry: `retry_count < 3` → requeue (`status = 'queued'`, unassign agent)
  - Permanent fail: `retry_count >= 3` → `status = 'failed_permanent'`
- **Task History:** Logs `failed`, `retried`, `permanently_failed` events ✅

**Auto-execution Ready:** ✅ YES
- Agent có thể báo fail, system tự động xử lý retry hoặc permanent fail


---

## 2. Approval Endpoints

### ✅ `/api/v1/approvals/:taskId/approve` (POST)
**Status:** Sẵn sàng

**Current Implementation:**
- **Body:** `{ rating?: number (1-5), comment?: string }` ✅
- **Updates:**
  - `status = 'completed'`
  - `approval_status = 'approved'`
  - `approval_rating`, `approval_feedback`, `approved_by`, `approved_at` ✅
- **Auth:** User or API key (via `authenticateUserOrApiKey`) ✅

**Auto-execution Ready:** ✅ YES
- User có thể approve qua UI hoặc Telegram callback


---

### ✅ `/api/v1/approvals/:taskId/reject` (POST)
**Status:** Sẵn sàng — comprehensive logic

**Current Implementation:**
- **Body:** `{ action: "revise" | "reassign" | "cancel", feedback?: string }` ✅
- **Actions:**
  - **revise:** Requeue task cho same agent (status = queued, keep agent assigned)
  - **reassign:** Tìm agent khác match skills → auto-assign hoặc queue nếu không tìm thấy
  - **cancel:** Set status = cancelled
- **Task History:** Logs `rejected`, `reassigned` events ✅
- **Response:** Includes `reassigned_to`, `no_agent_available` flag ✅

**Auto-execution Ready:** ✅ YES
- UI/Telegram có thể offer 3 actions
- Auto-reassignment logic sẵn sàng


---

## 3. Missing Endpoints for Phase 2A

### ❌ Telegram Notification Endpoints
**Status:** Thiếu hoàn toàn

**Current State:**
- **Không có** endpoint nào để:
  1. Send Telegram notification khi task completed/pending-approval
  2. Store Telegram chat_id mapping
  3. Configure user notification preferences

**Required Endpoints:**

#### a) **`POST /api/v1/notifications/send`**
- Send notification qua channel (telegram, email, webhook)
- Body: `{ user_id, channel: "telegram", message, task_id?, attachment? }`
- Response: `{ notification_id, status, sent_at }`

#### b) **`GET/POST /api/v1/users/preferences`**
- Get/Update user notification preferences
- Fields: `{ preferred_channel, telegram_chat_id, email_enabled, telegram_enabled }`

#### c) **`POST /api/v1/webhooks/telegram`**
- Telegram callback webhook cho inline buttons (approve/reject)
- Handle callback_query từ Telegram bot
- Body: Telegram update payload

**Recommended Actions:**
1. Build `/api/v1/notifications/send` endpoint → trigger từ task complete/fail events
2. Build `/api/v1/users/preferences` CRUD
3. Setup Telegram bot webhook endpoint `/api/v1/webhooks/telegram`
4. Add notification dispatch logic trong task lifecycle endpoints


---

### ❌ User Notification Preferences
**Status:** Thiếu trong database

**Current State:**
- `profiles` table **không có** columns cho:
  - `telegram_chat_id`
  - `preferred_channel` (telegram, email, webhook)
  - `notification_settings` (JSONB)

**Required Migration:**
```sql
ALTER TABLE public.profiles 
  ADD COLUMN telegram_chat_id TEXT,
  ADD COLUMN preferred_channel TEXT DEFAULT 'email' CHECK (preferred_channel IN ('email', 'telegram', 'webhook')),
  ADD COLUMN notification_settings JSONB DEFAULT '{"task_completed": true, "task_approval_needed": true, "task_failed": true}';
```

**Recommended Actions:**
1. Create migration `20260222_notification_preferences.sql`
2. Add columns to `profiles` table
3. Build UI/Telegram bot flow để user set `telegram_chat_id`


---

### ❌ Notification Delivery Log
**Status:** Thiếu tracking mechanism

**Current State:**
- Không có table để log notification delivery status
- Không biết notification nào sent/failed/pending

**Required Table:**
```sql
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  task_id UUID REFERENCES public.task_queue(id),
  channel TEXT NOT NULL, -- 'telegram', 'email', 'webhook'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message TEXT,
  error TEXT,
  external_id TEXT, -- telegram message_id, email message_id, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_log_user ON public.notification_log(user_id, created_at DESC);
CREATE INDEX idx_notification_log_task ON public.notification_log(task_id);
```

**Recommended Actions:**
1. Create migration cho `notification_log` table
2. Log mỗi notification attempt (pending → sent/failed)
3. Expose `/api/v1/notifications/history` endpoint (optional)


---

## 4. Database Schema Check

### ✅ Task Output Storage
**Status:** Sẵn sàng

**Current Schema:**
- `task_queue.output` (JSONB) ✅ — Stores arbitrary agent output
- `task_queue.error` (TEXT) ✅ — Stores error messages
- `task_queue.duration_ms` (INTEGER) ✅ — Execution time

**Auto-execution Ready:** ✅ YES


---

### ❌ User Notification Preferences
**Status:** Thiếu — see section 3 above

**Current Schema:**
- `profiles` table không có notification-related columns ❌
- Cần add: `telegram_chat_id`, `preferred_channel`, `notification_settings`


---

### ❌ Telegram Chat ID Mapping
**Status:** Thiếu

**Current State:**
- Không có cách nào map Supabase `user_id` → Telegram `chat_id`
- Không có table hoặc column để store mapping

**Options:**

**Option A:** Add column to `profiles` table (recommended for Phase 2A)
```sql
ALTER TABLE public.profiles ADD COLUMN telegram_chat_id TEXT;
CREATE INDEX idx_profiles_telegram ON public.profiles(telegram_chat_id);
```

**Option B:** Separate `user_integrations` table (better for multi-channel future)
```sql
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'telegram', 'slack', 'discord'
  platform_user_id TEXT NOT NULL, -- chat_id, user_id, etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);
```

**Recommended Actions:**
1. **Phase 2A:** Use Option A (simple column)
2. **Phase 2B+:** Migrate to Option B khi add Slack/Discord


---

### ✅ Task History
**Status:** Sẵn sàng

**Current Schema:**
- `task_history` table ✅
- Logs events: `failed`, `retried`, `permanently_failed`, `rejected`, `reassigned`
- Already used by `/fail` and `/reject` endpoints

**Auto-execution Ready:** ✅ YES


---

### ⚠️ Realtime Subscriptions
**Status:** Enabled nhưng cần test

**Current State:**
- `task_queue` và `agent_heartbeats` đã add vào `supabase_realtime` publication ✅
- Frontend có thể subscribe realtime updates

**Recommended Actions:**
1. Test realtime subscription cho task status changes
2. Ensure notification triggers fire on realtime events


---

## 5. Summary & Recommended Actions

### ✅ Sẵn Sàng (No Action Required)
1. Task lifecycle endpoints: claim, progress, complete, fail ✅
2. Approval endpoints: approve, reject ✅
3. Task output storage (JSONB) ✅
4. Task history logging ✅
5. Retry logic với auto-requeue ✅
6. Realtime subscriptions enabled ✅

---

### ⚠️ Cần Sửa Nhỏ
1. **`/complete` endpoint:** Remove hardcoded `notification_sent: false`, add actual notification dispatch
2. **Test realtime subscriptions** cho task status updates

---

### ❌ Thiếu — Cần Build Mới (Priority for Phase 2A)

#### **High Priority:**
1. **Database Migration:** Add notification preferences to `profiles` table
   ```sql
   ALTER TABLE public.profiles 
     ADD COLUMN telegram_chat_id TEXT,
     ADD COLUMN preferred_channel TEXT DEFAULT 'email',
     ADD COLUMN notification_settings JSONB DEFAULT '{"task_completed": true, "task_approval_needed": true, "task_failed": true}';
   ```

2. **Notification Service:**
   - Build `/api/v1/notifications/send` endpoint
   - Integrate Telegram Bot API (send message, inline keyboard)
   - Trigger notifications từ task lifecycle events

3. **Telegram Webhook:**
   - Build `/api/v1/webhooks/telegram` endpoint
   - Handle callback_query (approve/reject buttons)
   - Map callback → API calls (`/approve`, `/reject`)

4. **User Preferences Endpoint:**
   - Build `/api/v1/users/preferences` (GET/PATCH)
   - Allow user set `telegram_chat_id` via Telegram bot `/start` command

#### **Medium Priority:**
5. **Notification Log Table:**
   - Create `notification_log` table
   - Log delivery status (pending/sent/failed)
   - Expose `/api/v1/notifications/history` endpoint (optional)

---

## 6. Phase 2A Implementation Checklist

- [ ] **Migration:** `20260222_notification_preferences.sql`
  - Add `telegram_chat_id`, `preferred_channel`, `notification_settings` to `profiles`
  - Create `notification_log` table

- [ ] **Telegram Bot Setup:**
  - Register bot với BotFather
  - Store bot token in env (`TELEGRAM_BOT_TOKEN`)
  - Implement `/start` command → save `chat_id` to user profile

- [ ] **API Endpoints:**
  - [ ] `POST /api/v1/notifications/send`
  - [ ] `POST /api/v1/webhooks/telegram`
  - [ ] `GET/PATCH /api/v1/users/preferences`

- [ ] **Notification Triggers:**
  - [ ] Hook `/complete` endpoint → send notification khi `status = 'completed'` or `'pending-approval'`
  - [ ] Hook `/fail` endpoint → send notification khi `status = 'failed_permanent'`
  - [ ] Telegram inline keyboard: [✅ Approve] [❌ Reject]

- [ ] **Testing:**
  - [ ] Agent completes task → Telegram notification sent
  - [ ] User clicks [Approve] → task approved
  - [ ] User clicks [Reject] → show action buttons (revise/reassign/cancel)
  - [ ] Realtime updates work on frontend

---

## 7. Estimated Effort

| Task | Effort | Owner |
|------|--------|-------|
| Database migration | 1h | Thép ⚙️ |
| Telegram bot setup | 2h | Kiến 🏗️ |
| `/notifications/send` endpoint | 3h | Kiến 🏗️ |
| `/webhooks/telegram` endpoint | 4h | Kiến 🏗️ |
| `/users/preferences` endpoint | 2h | Kiến 🏗️ |
| Integration testing | 3h | Soi 🔍 |
| **Total** | **15h** | **~2 days** |

---

**Conclusion:**  
Phase 2A có **foundation tốt** từ Phase 1. Task lifecycle và approval endpoints **sẵn sàng** cho auto-execution. Cần build **notification infrastructure** (Telegram bot, webhooks, preferences) để complete Phase 2A goals.

**Next Steps:**
1. Thép ⚙️ tạo migration cho notification preferences
2. Kiến 🏗️ build Telegram bot + notification service
3. Soi 🔍 test end-to-end flow

---

**End of Report**
