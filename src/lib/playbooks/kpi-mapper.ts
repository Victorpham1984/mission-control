/**
 * KPI Mapper — TypeScript mirror of the DB trigger logic
 *
 * The DB trigger (update_kpi_from_action) handles the actual KPI updates.
 * This module provides:
 *   - parseKpiSource(): parse 'action:<type>:<key>' convention
 *   - extractIncrement(): safely extract numeric value from evidence
 *   - shouldUpdateKpi(): full match check
 *
 * Used for testing and for app-level validation if needed.
 */

export interface KpiSourceMapping {
  actionType: string;
  evidenceKey: string;
}

/**
 * Parse KPI source field.
 * Format: 'action:<action_type>:<evidence_key>'
 * Returns null if not a valid action mapping.
 */
export function parseKpiSource(source: string | null): KpiSourceMapping | null {
  if (!source || !source.startsWith('action:')) return null;

  const parts = source.split(':');
  if (parts.length !== 3) return null;

  const actionType = parts[1];
  const evidenceKey = parts[2];

  if (!actionType || !evidenceKey) return null;

  return { actionType, evidenceKey };
}

/**
 * Extract a numeric increment from evidence JSONB.
 * Returns null if key is missing, non-numeric, zero, or negative.
 */
export function extractIncrement(
  evidence: Record<string, unknown>,
  evidenceKey: string,
): number | null {
  const raw = evidence[evidenceKey];
  if (raw === undefined || raw === null) return null;

  // Only accept number or string-that-parses-to-number
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;

  const num = Number(raw);
  if (isNaN(num) || num <= 0) return null;

  return num;
}

/**
 * Check if a KPI should be updated by a given action.
 * Returns the increment value, or null if no update should happen.
 */
export function shouldUpdateKpi(
  kpiSource: string | null,
  actionType: string,
  actionSuccess: boolean,
  evidence: Record<string, unknown>,
): number | null {
  if (!actionSuccess) return null;

  const mapping = parseKpiSource(kpiSource);
  if (!mapping) return null;

  if (mapping.actionType !== actionType) return null;

  return extractIncrement(evidence, mapping.evidenceKey);
}
