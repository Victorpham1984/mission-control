# KPI Auto-Update from Actions

## How it works

A PostgreSQL trigger (`on_action_update_kpi`) fires BEFORE INSERT on the `actions` table. When a successful action is inserted, it automatically increments matching KPI `current_value`.

## Mapping Convention

KPI `source` field format: `action:<action_type>:<evidence_key>`

| KPI Name | source | Matches action_type | Reads from evidence |
|----------|--------|--------------------|--------------------|
| Đơn hàng/tháng | `action:pull_orders:order_count` | `pull_orders` | `evidence.order_count` |
| Thời gian phản hồi chat | `action:reply_chat:avg_response_sec` | `reply_chat` | `evidence.avg_response_sec` |
| Tỷ lệ auto-process | `action:classify_orders:auto_rate` | `classify_orders` | `evidence.auto_rate` |

KPIs with `source = 'manual'`, `'calculated'`, or `'shopee_api'` are **not affected** by this trigger.

## Safety

- **Success only:** Failed actions (`success = false`) are skipped
- **Idempotency:** The trigger sets `evidence.kpi_updated = true` to prevent double-count on replay
- **Company-scoped:** Only updates KPIs for the same `company_id` as the action
- **Type-safe:** Non-numeric evidence values are silently skipped (no crash)
- **Zero/negative:** Values ≤ 0 are skipped

## Known Limits

- **Additive only:** Values are always incremented. Returns/cancellations need manual KPI adjustment
- **1:1 mapping:** Each KPI maps to one evidence key. Compound metrics (e.g., ratio of two fields) should use `source = 'calculated'`
- **No time windowing:** KPI accumulates across all time. Daily/weekly reset requires a separate mechanism

## Adding New Mappings

1. Create or update KPI with source = `action:<action_type>:<evidence_key>`
2. Ensure the action's `evidence` JSONB contains the key with a numeric value
3. The trigger handles the rest automatically

## Migration

File: `supabase/migrations/20260315_kpi_auto_update_trigger.sql`

Rollback:
```sql
DROP TRIGGER IF EXISTS on_action_update_kpi ON public.actions;
DROP FUNCTION IF EXISTS public.update_kpi_from_action();
```
