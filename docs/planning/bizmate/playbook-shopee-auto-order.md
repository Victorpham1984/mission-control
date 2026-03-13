# Playbook: Shopee Auto-Order

**Category:** ecommerce
**Target user:** Shopee seller 10-100 đơn/ngày
**Goal:** Tự động xử lý đơn hàng, giảm 80% thời gian thủ công
**Status:** Draft v1 — ready for review

---

## Overview

Playbook này tự động hóa quy trình xử lý đơn hàng Shopee từ lúc khách đặt đến lúc giao thành công. Gồm 3 nhóm agent: (1) xử lý đơn mới, (2) trả lời chat khách, (3) đồng bộ tồn kho. Chạy mỗi 15 phút, xử lý batch đơn mới. CEO chỉ cần duyệt đơn bất thường (giá trị cao, hết hàng, địa chỉ lạ).

**Luồng chính:**
```
Đơn mới trên Shopee → BizMate pull đơn → Agent phân loại → Xử lý tự động → Report CEO
```

**Giá trị:**
- Seller 80 đơn/ngày: từ 10 giờ/ngày → 2 giờ/ngày (review + exception handling)
- Thời gian phản hồi chat: từ 15 phút → < 2 phút (auto-reply FAQ)
- Sai sót đơn: giảm 60% (loại bỏ copy-paste thủ công)

---

## Required Skills

| Skill ID | Tên | Mô tả | Agent type |
|----------|-----|-------|------------|
| `order-processing` | Xử lý đơn hàng | Confirm đơn, gán vận chuyển, cập nhật trạng thái | ai |
| `customer-service` | Chăm sóc khách | Trả lời chat FAQ, escalate case phức tạp | ai |
| `inventory-sync` | Đồng bộ kho | Check tồn kho, cảnh báo sắp hết, update stock | ai |

---

## Steps (Workflow) — 7 bước

### Step 1: Pull đơn hàng mới
- **Trigger:** Cron `*/15 * * * *` (mỗi 15 phút)
- **Agent skill:** `order-processing`
- **Action:** Gọi Shopee API `GET /api/v2/order/get_order_list` (status = READY_TO_SHIP) HOẶC đọc từ CSV upload (manual mode)
- **Output:** Danh sách đơn mới chưa xử lý
- **Fallback (no API):** CEO upload CSV export từ Shopee Seller Center → parser extract đơn mới

### Step 2: Phân loại đơn hàng
- **Agent skill:** `order-processing`
- **Action:** Phân loại mỗi đơn theo rules:
  - **Auto-process:** Đơn thường (sản phẩm có sẵn, địa chỉ hợp lệ, giá trị < 2 triệu VNĐ)
  - **Cần duyệt:** Đơn giá trị cao (> 2 triệu), sản phẩm sắp hết hàng (stock < 5), địa chỉ vùng sâu/hải đảo
  - **Reject:** Đơn trùng lặp, địa chỉ không hợp lệ
- **Output:** Đơn tagged: `auto` | `needs_approval` | `reject`
- **Config override:** `auto_process_threshold` (default 2,000,000 VNĐ), `low_stock_threshold` (default 5)

### Step 3: Xử lý tự động đơn "auto"
- **Agent skill:** `order-processing`
- **Action:**
  1. Confirm đơn trên Shopee (`POST /api/v2/order/handle_buyer_cancellation` nếu cần)
  2. Chọn đơn vị vận chuyển (`POST /api/v2/logistics/get_shipping_parameter`)
  3. Tạo mã vận đơn (`POST /api/v2/logistics/create_shipping_document`)
  4. Log action: `fulfill_order` với evidence (order_id, tracking_number, shipping_provider)
- **Output:** Đơn đã confirm + có mã vận đơn
- **Fallback (no API):** Tạo checklist cho staff: "Đơn #X → Confirm → Chọn GHN/GHTK → In đơn"

### Step 4: Queue đơn "needs_approval" cho CEO
- **Agent skill:** `order-processing`
- **Action:** Tạo task trong `task_queue` (needs_approval = true) với thông tin đơn đầy đủ
- **Output:** CEO nhận notification (dashboard + Telegram) → approve/reject
- **Requires approval:** true
- **Timeout:** 4 giờ (nếu CEO không duyệt → reminder notification)

### Step 5: Trả lời chat khách tự động
- **Trigger:** Shopee chat webhook HOẶC poll mỗi 5 phút
- **Agent skill:** `customer-service`
- **Action:**
  1. Phân loại câu hỏi: FAQ (giá, size, ship, COD) vs. complaint vs. custom
  2. FAQ → auto-reply từ template (configurable)
  3. Complaint/custom → escalate tạo task cho CEO review
- **FAQ templates mặc định:**
  - Hỏi giá: "Dạ giá sản phẩm [X] là [Y] ạ. Anh/chị đặt ngay để được ưu đãi nhé!"
  - Hỏi ship: "Dạ shop giao qua GHN/GHTK, thời gian 2-4 ngày ạ. Free ship cho đơn từ [Z] ạ."
  - Hỏi size: "Dạ anh/chị tham khảo bảng size trong mô tả sản phẩm nhé. Nếu cần tư vấn thêm em hỗ trợ ạ!"
  - Hỏi COD: "Dạ shop có hỗ trợ COD (thanh toán khi nhận hàng) ạ."
- **Output:** Tin nhắn đã gửi + log action `reply_chat`
- **Config override:** `auto_reply_enabled` (default true), `escalation_keywords` (default ["hoàn tiền", "lỗi", "khiếu nại"])
- **Fallback (no API):** Tạo danh sách reply gợi ý → staff copy-paste vào Shopee chat

### Step 6: Đồng bộ tồn kho
- **Trigger:** Sau mỗi batch xử lý đơn (step 3 hoàn thành)
- **Agent skill:** `inventory-sync`
- **Action:**
  1. Trừ stock theo đơn đã confirm
  2. Check sản phẩm nào stock < `low_stock_threshold` → alert CEO
  3. Cập nhật Shopee inventory (`POST /api/v2/product/update_stock`) HOẶC log alert manual
- **Output:** Stock updated + alert list (nếu có)
- **Config override:** `low_stock_threshold` (default 5), `auto_update_stock` (default false cho MVP)
- **Fallback (no API):** Tạo report "Cần cập nhật tồn kho" → CEO update manual trên Seller Center

### Step 7: Report tổng hợp cuối ngày
- **Trigger:** Cron `0 21 * * *` (9 PM hàng ngày)
- **Agent skill:** `order-processing`
- **Action:** Tổng hợp metrics ngày:
  - Tổng đơn xử lý (auto + manual)
  - Đơn thành công / thất bại / pending
  - Chat đã trả lời (auto + escalated)
  - Cảnh báo tồn kho
  - Revenue estimate
- **Output:** Report gửi qua Telegram/dashboard notification
- **Action logged:** `daily_report`

---

## Config Schema (Full Example)

```json
{
  "required_skills": ["order-processing", "customer-service", "inventory-sync"],
  "default_agents": 2,
  "schedule": "*/15 * * * *",
  "report_schedule": "0 21 * * *",
  "kpi_template": [
    { "name": "Đơn xử lý/ngày", "unit": "count", "category": "operations", "target": 80 },
    { "name": "Thời gian phản hồi chat", "unit": "seconds", "category": "operations", "target": 120 },
    { "name": "Tỷ lệ auto-process", "unit": "%", "category": "operations", "target": 80 },
    { "name": "Doanh thu/tháng", "unit": "VND", "category": "revenue", "target": 100000000 }
  ],
  "steps": [
    {
      "order": 1,
      "action": "pull_orders",
      "agent_skill": "order-processing",
      "trigger": "schedule",
      "requires_approval": false,
      "config": {
        "source": "shopee_api",
        "fallback_source": "csv_upload",
        "order_status_filter": ["READY_TO_SHIP"]
      }
    },
    {
      "order": 2,
      "action": "classify_orders",
      "agent_skill": "order-processing",
      "trigger": "after_step_1",
      "requires_approval": false,
      "config": {
        "auto_process_threshold": 2000000,
        "low_stock_threshold": 5,
        "restricted_regions": ["hai_dao"]
      }
    },
    {
      "order": 3,
      "action": "fulfill_orders",
      "agent_skill": "order-processing",
      "trigger": "after_step_2",
      "requires_approval": false,
      "config": {
        "preferred_shipping": ["ghn", "ghtk", "viettel_post"],
        "auto_confirm": true
      }
    },
    {
      "order": 4,
      "action": "queue_approval",
      "agent_skill": "order-processing",
      "trigger": "after_step_2",
      "requires_approval": true,
      "config": {
        "approval_timeout_hours": 4,
        "reminder_after_hours": 2
      }
    },
    {
      "order": 5,
      "action": "reply_chat",
      "agent_skill": "customer-service",
      "trigger": "webhook",
      "requires_approval": false,
      "config": {
        "auto_reply_enabled": true,
        "escalation_keywords": ["hoàn tiền", "lỗi", "khiếu nại", "hàng giả"],
        "reply_language": "vi",
        "max_auto_replies_per_customer": 3
      }
    },
    {
      "order": 6,
      "action": "sync_inventory",
      "agent_skill": "inventory-sync",
      "trigger": "after_step_3",
      "requires_approval": false,
      "config": {
        "low_stock_threshold": 5,
        "auto_update_stock": false,
        "alert_channel": "telegram"
      }
    },
    {
      "order": 7,
      "action": "daily_report",
      "agent_skill": "order-processing",
      "trigger": "schedule",
      "requires_approval": false,
      "config": {
        "report_time": "21:00",
        "report_channel": "telegram",
        "include_revenue": true
      }
    }
  ]
}
```

---

## Expected Actions

Mỗi action được log vào bảng `actions` và feed vào KPIs tự động.

| Action type | Trigger | Success criteria | KPI impact |
|-------------|---------|-----------------|------------|
| `pull_orders` | Mỗi 15 phút | Đơn mới được import thành công | — (internal) |
| `classify_orders` | Sau pull | Tất cả đơn được tag (auto/approval/reject) | — (internal) |
| `fulfill_order` | Đơn auto | Có tracking number + status updated | Đơn xử lý/ngày +1 |
| `approve_order` | CEO duyệt | Đơn exception được confirm | Đơn xử lý/ngày +1 |
| `reply_chat` | Chat mới | Tin nhắn gửi thành công | Thời gian phản hồi chat |
| `escalate_chat` | Chat phức tạp | Task tạo cho CEO | — (internal) |
| `sync_inventory` | Sau fulfill | Stock đã trừ hoặc alert gửi | — (internal) |
| `low_stock_alert` | Stock < threshold | CEO nhận alert | — (alert) |
| `daily_report` | 9 PM | Report gửi thành công | — (summary) |

---

## Fallback Mode (No Shopee API)

Nếu Blocker 2 chưa resolve, playbook chạy ở **manual mode**:

| Step | API mode | Manual mode |
|------|----------|-------------|
| 1. Pull đơn | Shopee API auto-pull | CEO upload CSV từ Seller Center |
| 3. Fulfill | Auto confirm + shipping | Checklist cho staff thực hiện |
| 5. Chat | Webhook auto-reply | Gợi ý reply → staff copy-paste |
| 6. Inventory | API update stock | Report → CEO update manual |

Manual mode vẫn tạo value: phân loại đơn, gợi ý reply, daily report, KPI tracking.

---

## Open Questions (Updated)

- [x] ~~Playbook steps~~ → Resolved: 7 steps defined above
- [x] ~~Config schema~~ → Resolved: Full JSON example above
- [ ] Shopee API access: chờ Sếp Victor confirm (Blocker 2). Fallback mode sẵn sàng.
- [ ] Chat webhook: Shopee có push notification API cho chat không? Nếu không → poll mỗi 5 phút.
- [ ] FAQ templates: cần Sếp Victor review 4 mẫu reply mặc định.
