-- BizMate Phase 2: Seed — Shopee Auto-Order playbook + sample install + actions
-- Run after: 20260314_bizmate_phase2_playbooks.sql
-- Prerequisite: Phase 1 seed (company "Shop Hạnh Phúc" must exist)

DO $$
DECLARE
  v_playbook_id UUID;
  v_company_id UUID;
  v_installed_id UUID;
BEGIN

  -- ============================================================
  -- 1. Create Shopee Auto-Order playbook (system template)
  -- ============================================================
  INSERT INTO public.playbooks (name, description, category, author_id, config, is_public)
  VALUES (
    'Shopee Auto-Order',
    'Tự động xử lý đơn hàng Shopee: pull đơn → phân loại → fulfill → trả lời chat → đồng bộ kho → report. Giảm 80% thời gian thủ công cho seller 10-100 đơn/ngày.',
    'ecommerce',
    NULL,  -- system template
    '{
      "required_skills": ["order-processing", "customer-service", "inventory-sync"],
      "default_agents": 2,
      "schedule": "*/15 * * * *",
      "report_schedule": "0 21 * * *",
      "kpi_template": [
        {"name": "Đơn xử lý/ngày", "unit": "count", "category": "operations", "target": 80},
        {"name": "Thời gian phản hồi chat", "unit": "seconds", "category": "operations", "target": 120},
        {"name": "Tỷ lệ auto-process", "unit": "%", "category": "operations", "target": 80},
        {"name": "Doanh thu/tháng", "unit": "VND", "category": "revenue", "target": 100000000}
      ],
      "steps": [
        {
          "order": 1,
          "action": "pull_orders",
          "agent_skill": "order-processing",
          "trigger": "schedule",
          "requires_approval": false,
          "config": {"source": "shopee_api", "fallback_source": "csv_upload", "order_status_filter": ["READY_TO_SHIP"]}
        },
        {
          "order": 2,
          "action": "classify_orders",
          "agent_skill": "order-processing",
          "trigger": "after_step_1",
          "requires_approval": false,
          "config": {"auto_process_threshold": 2000000, "low_stock_threshold": 5, "restricted_regions": ["hai_dao"]}
        },
        {
          "order": 3,
          "action": "fulfill_orders",
          "agent_skill": "order-processing",
          "trigger": "after_step_2",
          "requires_approval": false,
          "config": {"preferred_shipping": ["ghn", "ghtk", "viettel_post"], "auto_confirm": true}
        },
        {
          "order": 4,
          "action": "queue_approval",
          "agent_skill": "order-processing",
          "trigger": "after_step_2",
          "requires_approval": true,
          "config": {"approval_timeout_hours": 4, "reminder_after_hours": 2}
        },
        {
          "order": 5,
          "action": "reply_chat",
          "agent_skill": "customer-service",
          "trigger": "webhook",
          "requires_approval": false,
          "config": {"auto_reply_enabled": true, "escalation_keywords": ["hoàn tiền", "lỗi", "khiếu nại", "hàng giả"], "reply_language": "vi", "max_auto_replies_per_customer": 3}
        },
        {
          "order": 6,
          "action": "sync_inventory",
          "agent_skill": "inventory-sync",
          "trigger": "after_step_3",
          "requires_approval": false,
          "config": {"low_stock_threshold": 5, "auto_update_stock": false, "alert_channel": "telegram"}
        },
        {
          "order": 7,
          "action": "daily_report",
          "agent_skill": "order-processing",
          "trigger": "schedule",
          "requires_approval": false,
          "config": {"report_time": "21:00", "report_channel": "telegram", "include_revenue": true}
        }
      ]
    }'::jsonb,
    true  -- public marketplace
  )
  RETURNING id INTO v_playbook_id;

  RAISE NOTICE 'Created playbook: Shopee Auto-Order (id: %)', v_playbook_id;

  -- ============================================================
  -- 2. Install playbook to Shop Hạnh Phúc
  -- ============================================================
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE name = 'Shop Hạnh Phúc' AND deleted_at IS NULL
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Company "Shop Hạnh Phúc" not found. Skipping install + actions.';
    RETURN;
  END IF;

  INSERT INTO public.installed_playbooks (company_id, playbook_id, schedule, active)
  VALUES (
    v_company_id,
    v_playbook_id,
    '*/15 * * * *',
    true
  )
  RETURNING id INTO v_installed_id;

  RAISE NOTICE 'Installed playbook to company % (installed_id: %)', v_company_id, v_installed_id;

  -- ============================================================
  -- 3. Sample actions (simulating 1 run of the playbook)
  -- ============================================================
  INSERT INTO public.actions (company_id, installed_playbook_id, action_type, description, success, evidence, cost, duration_ms) VALUES
  (v_company_id, v_installed_id, 'pull_orders',
   'Pulled 12 new orders from Shopee (status: READY_TO_SHIP)',
   true, '{"order_count": 12, "source": "csv_upload"}'::jsonb, 0.01, 2300),

  (v_company_id, v_installed_id, 'classify_orders',
   'Classified 12 orders: 10 auto, 1 needs_approval, 1 reject',
   true, '{"auto": 10, "needs_approval": 1, "reject": 1}'::jsonb, 0.02, 1500),

  (v_company_id, v_installed_id, 'fulfill_order',
   'Auto-fulfilled 10 orders (GHN: 6, GHTK: 4)',
   true, '{"fulfilled": 10, "shipping": {"ghn": 6, "ghtk": 4}}'::jsonb, 0.05, 8200),

  (v_company_id, v_installed_id, 'approve_order',
   'Queued 1 high-value order for CEO approval (2.5M VND)',
   true, '{"order_value": 2500000, "reason": "above_threshold"}'::jsonb, 0.01, 500),

  (v_company_id, v_installed_id, 'reply_chat',
   'Auto-replied to 8 customer chats (FAQ: 6, escalated: 2)',
   true, '{"auto_replied": 6, "escalated": 2, "avg_response_sec": 45}'::jsonb, 0.08, 12000),

  (v_company_id, v_installed_id, 'sync_inventory',
   'Updated stock for 10 fulfilled orders. Alert: 2 products low stock',
   true, '{"updated": 10, "low_stock_alerts": 2}'::jsonb, 0.01, 1800),

  (v_company_id, v_installed_id, 'daily_report',
   'Daily summary: 12 orders processed, 10 fulfilled, revenue est. 15.2M VND',
   true, '{"total_orders": 12, "fulfilled": 10, "revenue_estimate": 15200000}'::jsonb, 0.03, 3500);

  RAISE NOTICE 'Created 7 sample actions for installed playbook %', v_installed_id;
  RAISE NOTICE 'Phase 2 seed complete!';

END $$;

-- ============================================================
-- Verify queries (run after seeding)
-- ============================================================

-- 1. List available playbooks
-- SELECT id, name, category, is_public, install_count FROM playbooks WHERE is_public = true;

-- 2. Check installed playbooks for a company
-- SELECT ip.id, p.name, ip.active, ip.schedule, ip.run_count
-- FROM installed_playbooks ip
-- JOIN playbooks p ON ip.playbook_id = p.id
-- WHERE ip.company_id = (SELECT id FROM companies WHERE name = 'Shop Hạnh Phúc' LIMIT 1);

-- 3. Query actions by playbook (ordered by step)
-- SELECT action_type, description, success, duration_ms, created_at
-- FROM actions
-- WHERE installed_playbook_id = (
--   SELECT ip.id FROM installed_playbooks ip
--   JOIN companies c ON ip.company_id = c.id
--   WHERE c.name = 'Shop Hạnh Phúc' LIMIT 1
-- )
-- ORDER BY created_at;
