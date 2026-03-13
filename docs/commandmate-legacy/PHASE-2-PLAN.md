# CommandMate Phase 2 - Agent Auto-Execution

> **Approved by Sếp Victor — 2026-02-21**
> **Strategy:** Hybrid — Telegram first (Week 5), then Zalo (Week 6)

## Vision

Biến CommandMate từ "quản lý trạng thái" → "tự động hóa công việc"

**Workflow đầy đủ:** Tạo task → Agent tự làm → Thông báo Sếp duyệt

---

## Phase 2A - Week 5: Telegram + Foundation

### Mục tiêu
- Telegram users: Full inline approval (⭐ rating, reject với feedback)
- Non-Telegram users: Dashboard notification + approve manually
- Architecture chuẩn sẵn sàng mở rộng Zalo

### Timeline

| Ngày | Task | Ai | Output |
|------|------|-----|--------|
| 1-2 | Connector auto-spawn + execute + submit | Phát 🚀 | Connector enhanced |
| 3 | NotificationService abstraction layer | Thép ⚙️ | `NotificationService` class |
| 4 | TelegramAdapter + inline buttons | Đệ 🐾 | Telegram approval working |
| 5 | Fallback notifications (other channels) | Đệ 🐾 | Dashboard-only notification |
| 6 | E2E testing | Soi 🔍 | Test report |
| 7 | Bug fixes + deploy | Squad | Production ready |

### Deliverables

**1. Connector Enhancement** (Phát 🚀)
- Auto-spawn agent khi poll task
- Execute task + capture output
- Submit output qua `POST /api/v1/tasks/:id/complete`
- Progress tracking (0% → 100%)
- Timeout handling (10 min default)
- Max concurrent tasks = 5

**2. NotificationService Abstraction** (Thép ⚙️)
```javascript
class NotificationService {
  async sendApprovalRequest(task, user) {
    const channel = user.preferred_channel; 
    switch(channel) {
      case 'telegram': return TelegramAdapter.sendInlineApproval(task, user.telegram_id);
      case 'zalo': return ZaloAdapter.sendButtonApproval(task, user.zalo_id);
      default: return DashboardAdapter.sendNotification(task, user.email);
    }
  }
  async handleCallback(channel, payload) {
    const {task_id, action, data} = this.parseCallback(channel, payload);
    return this.processApproval(task_id, action, data);
  }
}
```

**3. TelegramAdapter** (Đệ 🐾)
- Inline buttons: [⭐⭐⭐⭐⭐ Approve] [❌ Reject] [📝 Detail]
- Approve flow: rating modal (1-5 stars + comment)
- Reject flow: feedback form (revise/reassign/cancel)
- Message format:
```
✅ Task #123 hoàn thành

Agent: Kiến 🏗️
Title: Viết bài Facebook về son môi mới
Output preview: [200 chars...]

[⭐⭐⭐⭐⭐ Approve] [❌ Reject] [📝 Detail]
```

**4. Fallback Notification** (Đệ 🐾)
- Dashboard bell icon notification
- Email notification (optional)
- Link to task detail page

### Success Metrics
- ✅ 80% Telegram tasks approve qua inline buttons
- ✅ Response time < 30s (task complete → notification)
- ✅ Non-Telegram users vẫn approve được qua Dashboard

### Chi phí
- Connector + NotificationService: ~$15
- Telegram integration: ~$5
- Testing: ~$5
- **Total:** ~$25

---

## Phase 2B - Week 6: Zalo Integration

### Mục tiêu
Zalo users có approval tự động tương đương Telegram

### Timeline

| Ngày | Task | Ai | Output |
|------|------|-----|--------|
| 1 | Research Zalo OA API | Minh 📋 | API docs + capabilities |
| 2-3 | ZaloAdapter implementation | Thép ⚙️ | Zalo buttons working |
| 4 | Zalo webhook handler | Đệ 🐾 | Callback routing |
| 5-6 | E2E testing Zalo flow | Soi 🔍 | Test report |
| 7 | Deploy + monitor | Squad | Production |

### Zalo Requirements
- Zalo Official Account (OA) verified
- App ID + Secret Key
- Webhook URL public HTTPS
- SSL certificate

### Deliverables

**ZaloAdapter:**
```javascript
{
  sendButtonApproval(task, zalo_id) {
    // Zalo OA interactive buttons: [Duyệt 5⭐] [Từ chối]
  },
  parseCallback(payload) {
    // Parse Zalo webhook callback
  }
}
```

**User Flow:**
1. Task complete → Zalo OA message với buttons
2. Tap [Duyệt với 5 sao] → Done
3. Hoặc [Từ chối] → Form feedback → Gửi

### Success Metrics
- ✅ Zalo UX tương đương Telegram
- ✅ 90% tasks (Telegram + Zalo) approve tự động

### Chi phí
- Zalo research: ~$3
- Zalo adapter: ~$8
- Integration + testing: ~$5
- **Total:** ~$16

---

## Check-in với Sếp

| Thời điểm | Sếp review |
|-----------|-----------|
| Cuối ngày 2 (Week 5) | Demo: Connector auto-spawn + execute |
| Cuối ngày 4 (Week 5) | Demo: Telegram inline approval |
| Cuối ngày 7 (Week 5) | Demo: Full E2E flow + deploy |
| Cuối Week 6 | Demo: Zalo integration + final deploy |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Connector spawn quá nhiều agents → crash | High | Max concurrent = 5, queue overflow → wait |
| Agent timeout lâu → task stuck | Medium | Default 10 min timeout, configurable |
| Telegram/Zalo rate limit | Low | Debounce notifications, batch approvals |
| Zalo OA verification delay | Medium | Start verification process Week 5 |

---

## Definition of Done

**Phase 2A complete when:**
- ✅ Sếp tạo task → Agent tự làm (KHÔNG spawn thủ công)
- ✅ Sếp nhận Telegram notification với inline buttons
- ✅ Approve/Reject trên Telegram → Dashboard update real-time
- ✅ Non-Telegram users approve qua Dashboard

**Phase 2B complete when:**
- ✅ Zalo users có approval tự động
- ✅ 90% tasks approve qua Telegram/Zalo (không qua Dashboard)

---

## Architecture Summary

```
Task Created (Dashboard)
    ↓
Auto-Assigned (API)
    ↓
Connector Poll (30s interval)
    ↓
Auto-Spawn Agent (isolated session)
    ↓
Agent Execute + Capture Output
    ↓
Submit Output (POST /api/v1/tasks/:id/complete)
    ↓
NotificationService
    ↓
    ├─ Telegram → Inline buttons
    ├─ Zalo → Interactive buttons
    └─ Other → Dashboard notification
    ↓
Sếp Approve/Reject
    ↓
Dashboard Update Real-time
```

---

**Total investment Phase 2:** ~$40-45 (2 tuần)
**Expected ROI:** Sếp tiết kiệm 80% thời gian quản lý tasks
