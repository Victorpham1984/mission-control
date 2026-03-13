-- BizMate Phase 1: Sample seed data
-- Usage: Run manually via Supabase SQL Editor after migration
-- Prerequisite: At least 1 workspace must exist
-- NOTE: Replace 'YOUR_WORKSPACE_ID' with actual workspace UUID

-- ============================================================
-- Instructions:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Run: SELECT id, name FROM public.workspaces LIMIT 5;
-- 3. Copy workspace_id, replace below
-- 4. Run this script
-- ============================================================

DO $$
DECLARE
  v_workspace_id UUID;
  v_company_id UUID;
  v_goal_id UUID;
BEGIN
  -- Get first workspace (replace with specific ID if needed)
  SELECT id INTO v_workspace_id FROM public.workspaces LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE NOTICE 'No workspace found. Create a workspace first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Using workspace: %', v_workspace_id;

  -- ============================================================
  -- 1. Sample company: Shop Hạnh Phúc (from PRD persona)
  -- ============================================================
  INSERT INTO public.companies (workspace_id, name, industry, team_size, icp_segment, currency, settings)
  VALUES (
    v_workspace_id,
    'Shop Hạnh Phúc',
    'ecommerce',
    '6-20',
    'sme',
    'VND',
    '{"timezone": "Asia/Ho_Chi_Minh", "language": "vi"}'::jsonb
  )
  RETURNING id INTO v_company_id;

  RAISE NOTICE 'Created company: % (id: %)', 'Shop Hạnh Phúc', v_company_id;

  -- ============================================================
  -- 2. Sample goals (from onboarding step 3)
  -- ============================================================
  INSERT INTO public.goals (company_id, title, target_value, unit, deadline, status)
  VALUES (
    v_company_id,
    'Đạt 100 đơn hàng/tháng',
    100,
    'orders',
    (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date,
    'active'
  )
  RETURNING id INTO v_goal_id;

  INSERT INTO public.goals (company_id, title, target_value, unit, deadline, status)
  VALUES (
    v_company_id,
    'Doanh thu 50 triệu VNĐ/tháng',
    50000000,
    'revenue',
    (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date,
    'active'
  );

  RAISE NOTICE 'Created 2 goals for company %', v_company_id;

  -- ============================================================
  -- 3. Sample KPIs (auto-created from goal + playbook template)
  -- ============================================================

  -- KPI linked to goal: orders/month
  INSERT INTO public.kpis (company_id, goal_id, name, category, current_value, target_value, unit, source)
  VALUES (
    v_company_id, v_goal_id,
    'Đơn hàng/tháng', 'operations', 0, 100, 'count', 'calculated'
  );

  -- KPI: chat response time
  INSERT INTO public.kpis (company_id, goal_id, name, category, current_value, target_value, unit, source)
  VALUES (
    v_company_id, NULL,
    'Thời gian phản hồi chat', 'operations', 0, 120, 'seconds', 'calculated'
  );

  -- KPI: auto-process rate
  INSERT INTO public.kpis (company_id, goal_id, name, category, current_value, target_value, unit, source)
  VALUES (
    v_company_id, NULL,
    'Tỷ lệ auto-process', 'operations', 0, 80, '%', 'calculated'
  );

  -- KPI: monthly revenue
  INSERT INTO public.kpis (company_id, goal_id, name, category, current_value, target_value, unit, source)
  VALUES (
    v_company_id, NULL,
    'Doanh thu/tháng', 'revenue', 0, 50000000, 'VND', 'manual'
  );

  RAISE NOTICE 'Created 4 KPIs for company %', v_company_id;
  RAISE NOTICE 'Seed complete! Company: Shop Hạnh Phúc, 2 goals, 4 KPIs';

END $$;

-- ============================================================
-- Verify: Run these queries after seeding
-- ============================================================
-- SELECT c.name, c.industry, c.icp_segment FROM companies c WHERE deleted_at IS NULL;
-- SELECT g.title, g.target_value, g.unit, g.status FROM goals g;
-- SELECT k.name, k.category, k.target_value, k.unit, k.source FROM kpis k;
