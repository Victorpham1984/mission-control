-- KPI auto-update trigger: actions INSERT → kpis.current_value increment
--
-- Mapping convention:
--   KPI source field format: 'action:<action_type>:<evidence_key>'
--   Example: source = 'action:pull_orders:order_count'
--   When action with action_type='pull_orders' and success=true is inserted,
--   extracts evidence->>'order_count' as numeric, increments kpis.current_value.
--
-- Safety:
--   - Only processes actions where success = true
--   - Only matches KPIs with source starting with 'action:'
--   - Skips if evidence key is missing or non-numeric (no crash)
--   - Company-scoped: only updates KPIs for the same company_id
--   - Idempotency: uses kpi_updated flag in evidence to prevent double-count
--
-- Known limits:
--   - Assumes evidence values are additive (increment, not set)
--   - No decrement support (returns/cancellations need manual adjustment)
--   - One evidence key per KPI (1:1 mapping); compound metrics need 'calculated' source
--
-- Rollback: DROP TRIGGER IF EXISTS on_action_update_kpi ON public.actions;
--           DROP FUNCTION IF EXISTS public.update_kpi_from_action();

CREATE OR REPLACE FUNCTION public.update_kpi_from_action()
RETURNS TRIGGER AS $$
DECLARE
  v_kpi RECORD;
  v_parts TEXT[];
  v_action_type TEXT;
  v_evidence_key TEXT;
  v_raw_value TEXT;
  v_increment DECIMAL;
BEGIN
  -- Only process successful actions
  IF NOT NEW.success THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: skip if already processed
  IF NEW.evidence ? 'kpi_updated' AND (NEW.evidence->>'kpi_updated')::boolean = true THEN
    RETURN NEW;
  END IF;

  -- Find all KPIs for this company with 'action:*:*' source pattern
  FOR v_kpi IN
    SELECT id, source
    FROM public.kpis
    WHERE company_id = NEW.company_id
      AND source IS NOT NULL
      AND source LIKE 'action:%'
  LOOP
    -- Parse source: 'action:<action_type>:<evidence_key>'
    v_parts := string_to_array(v_kpi.source, ':');

    -- Must have exactly 3 parts
    IF array_length(v_parts, 1) != 3 THEN
      CONTINUE;
    END IF;

    v_action_type := v_parts[2];
    v_evidence_key := v_parts[3];

    -- Match action_type
    IF NEW.action_type != v_action_type THEN
      CONTINUE;
    END IF;

    -- Extract numeric value from evidence
    IF NOT NEW.evidence ? v_evidence_key THEN
      CONTINUE;
    END IF;

    v_raw_value := NEW.evidence->>v_evidence_key;

    -- Safe numeric conversion (skip if not a number)
    BEGIN
      v_increment := v_raw_value::DECIMAL;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    -- Skip zero or negative increments
    IF v_increment <= 0 THEN
      CONTINUE;
    END IF;

    -- Atomic increment
    UPDATE public.kpis
    SET current_value = current_value + v_increment,
        updated_at = now()
    WHERE id = v_kpi.id;
  END LOOP;

  -- Mark as processed (idempotency flag)
  NEW.evidence := NEW.evidence || '{"kpi_updated": true}'::jsonb;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire BEFORE INSERT so we can modify NEW.evidence with the kpi_updated flag
CREATE TRIGGER on_action_update_kpi
  BEFORE INSERT ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kpi_from_action();

-- Update seed KPI sources to use the new mapping convention
-- (Only if KPIs exist with old source values — safe to re-run)
UPDATE public.kpis
SET source = 'action:pull_orders:order_count'
WHERE name = 'Đơn hàng/tháng' AND source = 'calculated';

UPDATE public.kpis
SET source = 'action:reply_chat:avg_response_sec'
WHERE name = 'Thời gian phản hồi chat' AND source = 'calculated';

UPDATE public.kpis
SET source = 'action:classify_orders:auto_rate'
WHERE name = 'Tỷ lệ auto-process' AND source = 'calculated';

-- Revenue stays manual (not directly mapped to a single action evidence key)
-- UPDATE public.kpis SET source = 'action:daily_report:revenue_estimate'
-- WHERE name = 'Doanh thu/tháng' AND source = 'manual';
