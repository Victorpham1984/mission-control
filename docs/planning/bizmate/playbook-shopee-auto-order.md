# Playbook: Shopee Auto-Order

**Category:** ecommerce
**Target user:** Shopee seller 10-100 đơn/ngày
**Goal:** Tự động xử lý đơn hàng, giảm 80% thời gian thủ công

## Overview
[Mô tả ngắn gọn playbook làm gì]

## Required Skills
- [ ] `order-processing` — xử lý đơn hàng
- [ ] `customer-service` — trả lời chat khách
- [ ] `inventory-sync` — cập nhật tồn kho

## Steps (Workflow)
[Liệt kê 5-7 bước automation]

## Config Schema (Example)
```json
{
  "required_skills": ["order-processing", "customer-service"],
  "default_agents": 2,
  "schedule": "*/15 * * * *",
  "steps": [...]
}
```

## Expected Actions

[Actions mà playbook này tạo ra → feed vào KPIs]

## Open Questions

- [ ] Shopee API endpoint nào?
- [ ] Chat webhook có sẵn chưa?
- [ ] Inventory sync frequency?
