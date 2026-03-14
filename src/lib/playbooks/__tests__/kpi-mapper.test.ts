/**
 * KPI Mapper Tests — mirrors DB trigger logic for CI-safe testing
 *
 * Test matrix:
 *   1. Success action with valid mapping → returns increment value
 *   2. Failed action → returns null (no update)
 *   3. No mapping (source = 'manual') → returns null
 *   4. Malformed source (wrong format) → returns null, no crash
 *   5. Missing evidence key → returns null
 *   6. Non-numeric evidence value → returns null
 *   7. Zero value → returns null (no point incrementing by 0)
 *   8. Negative value → returns null
 *   9. Action type mismatch → returns null
 *  10. Multiple KPIs: only matching ones return increment
 *  11. parseKpiSource: valid formats
 *  12. parseKpiSource: invalid formats
 */

import { parseKpiSource, extractIncrement, shouldUpdateKpi } from '../kpi-mapper';

describe('parseKpiSource', () => {
  test('11. parses valid action:type:key format', () => {
    expect(parseKpiSource('action:pull_orders:order_count')).toEqual({
      actionType: 'pull_orders',
      evidenceKey: 'order_count',
    });

    expect(parseKpiSource('action:reply_chat:avg_response_sec')).toEqual({
      actionType: 'reply_chat',
      evidenceKey: 'avg_response_sec',
    });
  });

  test('12. rejects invalid formats', () => {
    expect(parseKpiSource(null)).toBeNull();
    expect(parseKpiSource('')).toBeNull();
    expect(parseKpiSource('manual')).toBeNull();
    expect(parseKpiSource('calculated')).toBeNull();
    expect(parseKpiSource('shopee_api')).toBeNull();
    expect(parseKpiSource('action:')).toBeNull();
    expect(parseKpiSource('action:pull_orders')).toBeNull(); // only 2 parts
    expect(parseKpiSource('action:pull_orders:count:extra')).toBeNull(); // 4 parts
    expect(parseKpiSource('action::key')).toBeNull(); // empty action type
    expect(parseKpiSource('action:type:')).toBeNull(); // empty key
  });
});

describe('extractIncrement', () => {
  test('extracts numeric value from evidence', () => {
    expect(extractIncrement({ order_count: 12 }, 'order_count')).toBe(12);
    expect(extractIncrement({ order_count: 0.5 }, 'order_count')).toBe(0.5);
    expect(extractIncrement({ count: '42' }, 'count')).toBe(42);
  });

  test('5. returns null for missing key', () => {
    expect(extractIncrement({}, 'order_count')).toBeNull();
    expect(extractIncrement({ other: 5 }, 'order_count')).toBeNull();
  });

  test('6. returns null for non-numeric value', () => {
    expect(extractIncrement({ order_count: 'abc' }, 'order_count')).toBeNull();
    expect(extractIncrement({ order_count: true }, 'order_count')).toBeNull();
    expect(extractIncrement({ order_count: {} }, 'order_count')).toBeNull();
    expect(extractIncrement({ order_count: [] }, 'order_count')).toBeNull();
    expect(extractIncrement({ order_count: null }, 'order_count')).toBeNull();
  });

  test('7. returns null for zero', () => {
    expect(extractIncrement({ order_count: 0 }, 'order_count')).toBeNull();
  });

  test('8. returns null for negative', () => {
    expect(extractIncrement({ order_count: -5 }, 'order_count')).toBeNull();
  });
});

describe('shouldUpdateKpi', () => {
  test('1. success action with valid mapping returns increment', () => {
    const result = shouldUpdateKpi(
      'action:pull_orders:order_count',
      'pull_orders',
      true,
      { order_count: 12, source: 'csv_upload' },
    );
    expect(result).toBe(12);
  });

  test('2. failed action returns null', () => {
    const result = shouldUpdateKpi(
      'action:pull_orders:order_count',
      'pull_orders',
      false,
      { order_count: 12 },
    );
    expect(result).toBeNull();
  });

  test('3. non-action source returns null', () => {
    expect(shouldUpdateKpi('manual', 'pull_orders', true, { order_count: 12 })).toBeNull();
    expect(shouldUpdateKpi('calculated', 'pull_orders', true, { order_count: 12 })).toBeNull();
    expect(shouldUpdateKpi('shopee_api', 'pull_orders', true, { order_count: 12 })).toBeNull();
    expect(shouldUpdateKpi(null, 'pull_orders', true, { order_count: 12 })).toBeNull();
  });

  test('4. malformed source returns null (no crash)', () => {
    expect(shouldUpdateKpi('action:', 'x', true, { x: 1 })).toBeNull();
    expect(shouldUpdateKpi('action:x', 'x', true, { x: 1 })).toBeNull();
    expect(shouldUpdateKpi('action:x:y:z', 'x', true, { y: 1 })).toBeNull();
  });

  test('9. action type mismatch returns null', () => {
    const result = shouldUpdateKpi(
      'action:pull_orders:order_count',
      'classify_orders',
      true,
      { order_count: 12 },
    );
    expect(result).toBeNull();
  });

  test('10. multiple KPIs: only matching ones return increment', () => {
    const kpis = [
      { source: 'action:pull_orders:order_count' },
      { source: 'action:reply_chat:auto_replied' },
      { source: 'manual' },
      { source: null },
    ];

    const evidence = { order_count: 12, auto_replied: 8 };

    const results = kpis.map(kpi =>
      shouldUpdateKpi(kpi.source, 'pull_orders', true, evidence),
    );

    expect(results[0]).toBe(12); // matches pull_orders:order_count
    expect(results[1]).toBeNull(); // wrong action_type (reply_chat != pull_orders)
    expect(results[2]).toBeNull(); // source = 'manual'
    expect(results[3]).toBeNull(); // source = null
  });

  test('handles evidence with string numbers (DB JSONB coercion)', () => {
    const result = shouldUpdateKpi(
      'action:pull_orders:order_count',
      'pull_orders',
      true,
      { order_count: '25' },
    );
    expect(result).toBe(25);
  });

  test('handles evidence with float values', () => {
    const result = shouldUpdateKpi(
      'action:daily_report:revenue_estimate',
      'daily_report',
      true,
      { revenue_estimate: 15200000.50 },
    );
    expect(result).toBe(15200000.50);
  });
});
