# CommandMate Agent API — Specification v1

> Phase 1 | Designed by Đệ 🐾 (System Architect) | 2026-02-18

## Base URL
```
Production: https://mission-control-sable-three.vercel.app/api/v1
Local:      http://localhost:3000/api/v1
```

## Authentication

Mỗi workspace có 1 **API key** (uuid format). Gửi trong header:
```
Authorization: Bearer <workspace-api-key>
```

API key được tạo tự động khi workspace được tạo. Founder có thể regenerate trên Settings.

---

## 1. AGENT ENDPOINTS

### 1.1 Register Agent
```
POST /agents/register
```

Agent tự đăng ký vào workspace khi khởi động.

**Request:**
```json
{
  "name": "Kiến 🏗️",
  "external_id": "openclaw-agent-kien",
  "type": "openclaw",
  "role": "Frontend Developer",
  "skills": ["react", "nextjs", "tailwind", "content-creation"],
  "capacity": 3,
  "metadata": {
    "runtime": "openclaw",
    "version": "2026.2.17"
  }
}
```

**Response: 201**
```json
{
  "agent_id": "uuid",
  "api_token": "agent-specific-token",
  "workspace_id": "uuid",
  "status": "registered"
}
```

**Logic:**
- Nếu `external_id` đã tồn tại → update thay vì tạo mới (idempotent)
- Agent nhận `api_token` riêng để dùng cho các call tiếp theo
- Skills được lưu để Task Queue matching

---

### 1.2 Heartbeat
```
POST /agents/:agent_id/heartbeat
```

Agent gửi mỗi 60 giây để báo "còn sống".

**Request:**
```json
{
  "status": "idle",
  "current_task_id": null,
  "load": 0.2,
  "metadata": {}
}
```

**Response: 200**
```json
{
  "ack": true,
  "pending_tasks": 3,
  "server_time": "2026-02-18T14:30:00Z"
}
```

**Logic:**
- Status: `idle` | `busy` | `error`
- Agent không heartbeat > 5 phút → tự động chuyển `offline`
- Response kèm `pending_tasks` để agent biết có việc chờ

---

### 1.3 Update Status
```
PATCH /agents/:agent_id/status
```

**Request:**
```json
{
  "status": "busy",
  "status_message": "Đang viết bài Facebook #3"
}
```

**Response: 200**
```json
{
  "agent_id": "uuid",
  "status": "busy",
  "updated_at": "2026-02-18T14:30:00Z"
}
```

---

## 2. TASK ENDPOINTS

### 2.1 Create Task
```
POST /tasks
```

Tạo task mới (gọi bởi Đệ 🐾 sau khi parse lệnh Telegram, hoặc từ Dashboard).

**Request:**
```json
{
  "title": "Viết bài Facebook - Son môi mới #1",
  "description": "Viết bài review son môi mới, tone vui vẻ, target nữ 25-35, dưới 150 words, kèm suggestion hình ảnh",
  "type": "content-creation",
  "priority": "normal",
  "required_skills": ["content-creation"],
  "needs_approval": true,
  "parent_task_id": null,
  "metadata": {
    "source": "telegram",
    "requested_by": "founder",
    "telegram_message_id": "12345",
    "batch_id": "uuid-of-batch",
    "batch_total": 5,
    "batch_index": 1
  }
}
```

**Response: 201**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "position_in_queue": 2,
  "estimated_assignment": "< 1 min",
  "created_at": "2026-02-18T14:30:00Z"
}
```

**Priority levels:**
- `urgent` → Agent nhận ngay (interrupt nếu cần)
- `normal` → Vào queue, agent nhận khi rảnh
- `background` → Chỉ chạy khi không có task normal/urgent

**Task types (mở rộng dần):**
- `content-creation` — viết bài, caption, email
- `data-analysis` — phân tích data, report
- `code-task` — code, fix bug, review
- `research` — tìm hiểu, tổng hợp
- `custom` — tự định nghĩa

---

### 2.2 Get Available Tasks (Agent pulls)
```
GET /tasks/available?skills=content-creation,react&limit=5
```

Agent hỏi "có task nào cho tôi không?" — match theo skills.

**Response: 200**
```json
{
  "tasks": [
    {
      "task_id": "uuid",
      "title": "Viết bài Facebook - Son môi #1",
      "type": "content-creation",
      "priority": "normal",
      "required_skills": ["content-creation"],
      "created_at": "2026-02-18T14:30:00Z",
      "waiting_since": "2m ago"
    }
  ],
  "total_available": 3
}
```

---

### 2.3 Claim Task
```
POST /tasks/:task_id/claim
```

Agent nhận task. Chỉ 1 agent được claim mỗi task (first come first served).

**Request:**
```json
{
  "agent_id": "uuid",
  "estimated_duration_minutes": 30
}
```

**Response: 200**
```json
{
  "task_id": "uuid",
  "status": "in-progress",
  "claimed_by": "uuid",
  "claimed_at": "2026-02-18T14:31:00Z"
}
```

**Response: 409 (đã bị agent khác nhận)**
```json
{
  "error": "task_already_claimed",
  "claimed_by": "agent-name"
}
```

---

### 2.4 Report Progress
```
POST /tasks/:task_id/progress
```

Agent báo tiến độ (optional, nhưng tốt cho UX).

**Request:**
```json
{
  "agent_id": "uuid",
  "progress_percent": 60,
  "status_message": "Đã viết xong draft, đang review lại"
}
```

**Response: 200**
```json
{
  "ack": true
}
```

→ Dashboard cập nhật realtime. Nếu Sếp đang xem → thấy progress bar chạy.

---

### 2.5 Complete Task
```
POST /tasks/:task_id/complete
```

Agent nộp kết quả.

**Request:**
```json
{
  "agent_id": "uuid",
  "output": {
    "content": "🌟 Son môi mới từ Brand X...",
    "format": "text",
    "word_count": 142,
    "attachments": []
  },
  "duration_ms": 180000,
  "notes": "Đã follow brand voice guideline, tone vui, dưới 150 words"
}
```

**Response: 200**
```json
{
  "task_id": "uuid",
  "status": "pending-approval",
  "approval_queue_position": 1,
  "notification_sent": true
}
```

**Logic:**
- Nếu `needs_approval = true` → status = `pending-approval`, vào Approval Queue
- Nếu `needs_approval = false` → status = `completed`, done
- Trigger notification tới Founder (qua Telegram)

---

### 2.6 Fail Task
```
POST /tasks/:task_id/fail
```

Agent báo không làm được.

**Request:**
```json
{
  "agent_id": "uuid",
  "error": "API rate limit exceeded",
  "retry_suggested": true
}
```

**Response: 200**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "action": "reassigned",
  "next_agent": "Thép ⚙️"
}
```

**Logic:**
- Nếu `retry_suggested = true` → quay lại queue, agent khác nhận
- Nếu fail 3 lần → status = `failed`, alert Founder
- Log error để analytics

---

## 3. APPROVAL ENDPOINTS

### 3.1 Get Approval Queue
```
GET /approvals?status=pending&limit=10
```

**Response: 200**
```json
{
  "approvals": [
    {
      "task_id": "uuid",
      "title": "Viết bài Facebook - Son môi #1",
      "agent_name": "Kiến 🏗️",
      "output_preview": "🌟 Son môi mới từ Brand X...",
      "completed_at": "2026-02-18T15:00:00Z",
      "waiting_since": "5m"
    }
  ],
  "total_pending": 3
}
```

### 3.2 Approve Task
```
POST /approvals/:task_id/approve
```

**Request:**
```json
{
  "approved_by": "founder",
  "rating": 5,
  "comment": "Tốt lắm!"
}
```

### 3.3 Reject Task
```
POST /approvals/:task_id/reject
```

**Request:**
```json
{
  "rejected_by": "founder",
  "feedback": "Ngắn hơn, thêm emoji, bớt formal",
  "action": "revise"
}
```

**Actions:**
- `revise` → Task quay lại queue kèm feedback, cùng agent nhận lại
- `reassign` → Task quay lại queue, agent khác nhận
- `cancel` → Huỷ task

---

## 4. METRICS ENDPOINTS (read-only, cho Dashboard)

### 4.1 Outcome Summary
```
GET /metrics/outcomes?period=today
```

**Response:**
```json
{
  "period": "today",
  "tasks_completed": 12,
  "tasks_pending_approval": 3,
  "tasks_in_progress": 2,
  "tasks_failed": 1,
  "agents_active": 4,
  "avg_completion_time_minutes": 25,
  "approval_rate": 0.92
}
```

### 4.2 Agent Performance
```
GET /metrics/agents/:agent_id
```

**Response:**
```json
{
  "agent_id": "uuid",
  "name": "Kiến 🏗️",
  "tasks_completed": 45,
  "success_rate": 0.94,
  "avg_quality_rating": 4.2,
  "avg_completion_minutes": 28,
  "top_skills": ["content-creation", "react"]
}
```

---

## DB SCHEMA MỞ RỘNG

### Bảng mới: `workspace_api_keys`
```sql
CREATE TABLE workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,  -- "cm_" + first 8 chars (hiển thị)
  name TEXT DEFAULT 'Default',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);
```

### Bảng mới: `agent_skills`
```sql
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  skill TEXT NOT NULL,
  proficiency REAL DEFAULT 1.0,  -- 0.0 - 1.0
  UNIQUE(agent_id, skill)
);
```

### Bảng mới: `task_queue` (thay thế tasks cũ)
```sql
CREATE TABLE task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'background')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'in-progress', 'pending-approval', 'completed', 'failed', 'cancelled')),
  required_skills TEXT[] DEFAULT '{}',
  needs_approval BOOLEAN DEFAULT true,
  
  -- Assignment
  assigned_agent_id UUID REFERENCES agents(id),
  claimed_at TIMESTAMPTZ,
  
  -- Progress
  progress_percent INTEGER DEFAULT 0,
  status_message TEXT,
  
  -- Result
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  
  -- Approval
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_feedback TEXT,
  approval_rating INTEGER CHECK (approval_rating BETWEEN 1 AND 5),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- Batch support
  parent_task_id UUID REFERENCES task_queue(id),
  batch_id UUID,
  batch_index INTEGER,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### Bảng mới: `agent_heartbeats`
```sql
CREATE TABLE agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  status TEXT NOT NULL,
  load REAL DEFAULT 0,
  current_task_id UUID REFERENCES task_queue(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chỉ giữ 24h heartbeats, cleanup cron
CREATE INDEX idx_heartbeats_agent_time ON agent_heartbeats(agent_id, created_at DESC);
```

### Cập nhật bảng `agents`
```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 3;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_token_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status_message TEXT;
```

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Heartbeat | 1/phút/agent |
| Task available | 10/phút/agent |
| Task claim | 30/phút/agent |
| Task complete | 30/phút/agent |
| Create task | 60/phút/workspace |

---

## Error Format

```json
{
  "error": "error_code",
  "message": "Human readable message",
  "details": {}
}
```

Common errors:
- `unauthorized` — API key không hợp lệ
- `agent_not_found` — Agent chưa register
- `task_not_found` — Task không tồn tại
- `task_already_claimed` — Task đã bị nhận
- `rate_limit_exceeded` — Quá nhiều request
- `validation_error` — Input không hợp lệ
