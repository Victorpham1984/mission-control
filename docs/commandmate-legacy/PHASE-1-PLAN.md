# CommandMate Phase 1: Agent API + Task Queue

> **Approved by Sếp Victor — 2026-02-18**

## Mục tiêu

Sếp nhắn Telegram → Đệ nhận lệnh → tạo task → Agent tự nhận → làm → nộp → Sếp duyệt trên Telegram hoặc Dashboard.

**Telegram = điều khiển (80% thời gian)**
**Dashboard = giám sát (xem tổng thể, duyệt phức tạp)**

---

## Timeline: 6 tuần

### Tuần 1: Thiết kế + DB mở rộng

| Việc | Ai làm | Output |
|------|--------|--------|
| Thiết kế API spec đầy đủ | Đệ 🐾 | API-SPEC.md |
| Thiết kế Telegram command flow | Đệ 🐾 | TELEGRAM-FLOW.md |
| DB: bảng task_queue, agent_skills, task_results, approval_queue | Thép ⚙️ | Migration SQL |
| Setup API routes `/api/v1/...` | Thép ⚙️ | API skeleton |
| Test plan Phase 1 | Soi 🔍 | TEST-PLAN.md |

**Milestone:** Sếp duyệt API spec + Telegram flow trước khi code.

### Tuần 2: Agent Registration + Heartbeat

| Việc | Ai làm | Output |
|------|--------|--------|
| `POST /api/v1/agents/register` — agent tự đăng ký (kèm skills) | Thép ⚙️ | API |
| `POST /api/v1/agents/heartbeat` — agent báo "còn sống" | Thép ⚙️ | API |
| `POST /api/v1/agents/status` — cập nhật trạng thái | Thép ⚙️ | API |
| API key auth (mỗi workspace 1 key) | Thép ⚙️ | Auth middleware |
| Dashboard: agent online/offline theo heartbeat thật | Kiến 🏗️ | UI update |

**Sếp thấy:** Dashboard hiện agent online/offline thật sự.

### Tuần 3: Task Queue + Telegram Command Flow

| Việc | Ai làm | Output |
|------|--------|--------|
| `POST /api/v1/tasks` — tạo task qua API | Thép ⚙️ | API |
| `GET /api/v1/tasks/available` — agent hỏi có task không | Thép ⚙️ | API |
| `POST /api/v1/tasks/:id/claim` — agent nhận task | Thép ⚙️ | API |
| `POST /api/v1/tasks/:id/progress` — báo tiến độ | Thép ⚙️ | API |
| Smart assignment — match task với agent skills | Thép ⚙️ | Engine |
| **Telegram flow: Sếp nhắn → Đệ parse → tạo task qua API** | Đệ 🐾 | Integration |
| **Telegram: Đệ báo "Task đã giao cho Kiến, đang làm 45%"** | Đệ 🐾 | Notification |
| Dashboard: backup form tạo task (không phải flow chính) | Kiến 🏗️ | UI |

**Sếp thấy:** Nhắn Telegram "Viết 5 bài FB" → Đệ reply "Đã chia 5 task, giao Kiến 🏗️" → Dashboard hiện 5 tasks đang chạy.

### Tuần 4: Task Completion + Approval trên Telegram

| Việc | Ai làm | Output |
|------|--------|--------|
| `POST /api/v1/tasks/:id/complete` — agent nộp kết quả | Thép ⚙️ | API |
| `POST /api/v1/tasks/:id/fail` — agent báo lỗi | Thép ⚙️ | API |
| Task xong → auto-route vào Approval Queue | Thép ⚙️ | Logic |
| **Telegram: Đệ gửi output cho Sếp duyệt** | Đệ 🐾 | Integration |
| **Telegram: Sếp reply "OK" → approve, "Sửa lại..." → reject + feedback** | Đệ 🐾 | Integration |
| Dashboard: Approval Queue (duyệt phức tạp, xem nhiều output) | Kiến 🏗️ | UI |
| Task fail → auto-retry hoặc reassign | Thép ⚙️ | Logic |

**Sếp thấy:** Đệ nhắn "Bài #3 xong, Sếp duyệt nhé: [nội dung]" → Sếp reply "OK" → Done. Hoặc mở Dashboard xem tất cả output cần duyệt.

### Tuần 5: OpenClaw Connector v2

| Việc | Ai làm | Output |
|------|--------|--------|
| OpenClaw agent tự đăng ký vào CommandMate khi khởi động | Phát 🚀 | Boot script |
| OpenClaw agent gọi Task API (nhận, báo, nộp) | Phát 🚀 | Integration |
| Dùng OpenClaw webhook/cron để trigger | Phát 🚀 | Webhook |
| Thay cron sync cũ (1 chiều) bằng connector mới (2 chiều) | Phát 🚀 | Migration |
| E2E test: Agent thật nhận task từ CommandMate | Soi 🔍 | Test report |

**Sếp thấy:** Agent thật (không mock) chạy full flow lần đầu tiên.

### Tuần 6: QA + Polish + Deploy

| Việc | Ai làm | Output |
|------|--------|--------|
| QA full flow: Telegram → task → agent → output → duyệt | Soi 🔍 | Bug report |
| Fix bugs | Thép ⚙️ + Kiến 🏗️ | Patches |
| API documentation | Minh 📋 | API docs |
| Security review (API key, rate limit, validation) | Soi 🔍 | Security report |
| Deploy production | Phát 🚀 | Live |
| Demo cho Sếp | Đệ 🐾 | Walkthrough |

**Sếp thấy:** Hệ thống hoàn chỉnh, dùng thật được.

---

## Flow chính (Telegram-first)

```
Sếp nhắn Telegram
  "Viết 5 bài Facebook về son môi mới, tone vui"
       │
       ▼
  Đệ 🐾 nhận → parse ý định → gọi CommandMate API
  → POST /api/v1/tasks (x5 sub-tasks)
  → Reply: "Đã tạo 5 task, giao Kiến 🏗️ xử lý"
       │
       ▼
  Kiến 🏗️ (OpenClaw agent)
  → GET /tasks/available → nhận task #1
  → Viết bài
  → POST /tasks/1/complete { content: "..." }
       │
       ▼
  CommandMate → route vào Approval Queue
  → Trigger Đệ 🐾 thông báo
       │
       ▼
  Đệ 🐾 nhắn Telegram cho Sếp:
  "Bài #1 xong ✅ Sếp duyệt nhé:
   [preview nội dung]
   Reply OK để duyệt, hoặc ghi feedback để sửa"
       │
       ▼
  Sếp reply: "OK" → Approve
  Sếp reply: "Ngắn hơn, thêm emoji" → Reject + feedback
       │
       ▼
  Nếu reject → Task quay lại queue kèm feedback
  → Agent nhận → sửa → nộp lại
```

## Dashboard dùng khi nào

| Tình huống | Dùng Dashboard |
|------------|---------------|
| Xem tổng: hôm nay bao nhiêu task xong | ✅ Outcome view |
| So sánh nhiều output cùng lúc | ✅ Approval Queue |
| Xem agent nào hiệu quả nhất | ✅ Performance |
| Xem chi phí tháng này | ✅ Cost tracker |
| Tạo task phức tạp (nhiều field, đính kèm file) | ✅ Task form |

---

## Check-in với Sếp

| Thời điểm | Sếp review |
|-----------|-----------|
| Cuối tuần 1 | Duyệt API spec + Telegram flow |
| Cuối tuần 3 | Demo: nhắn Telegram → task tạo → agent nhận |
| Cuối tuần 5 | Demo: full flow với agent thật |
| Cuối tuần 6 | Duyệt deploy production |

---

## Phân công

| Agent | Việc chính | Khối lượng |
|-------|-----------|------------|
| Đệ 🐾 | Thiết kế + Telegram integration + điều phối | Xuyên suốt |
| Thép ⚙️ | Toàn bộ API backend | Nặng nhất |
| Kiến 🏗️ | Dashboard UI updates | Trung bình |
| Phát 🚀 | OpenClaw connector + deploy | Tập trung T5-6 |
| Soi 🔍 | Test plan + QA + security | T1 + T5-6 |
| Minh 📋 | API spec review + docs | T1 + T6 |

---

## Chi phí: ~$5-15 (AI model usage cho sub-agents)
