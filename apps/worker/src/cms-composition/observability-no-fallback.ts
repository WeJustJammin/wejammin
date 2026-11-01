import { CMS_LOCALE_NO_FALLBACK_REASONS } from '@wejammin/contracts';

import { metricKey } from '../content-schema-registry/route-metric-key';

/*
 * P2-S12-AC-051: kept apart from `observability-metrics` because the Slice 11 route telemetry
 * (`cms-editorial/workflow-telemetry`) consumes it and `observability-metrics` consumes the Slice 11 outcome
 * mapper; a shared module would be a circular import.
 */

type Counters = Record<string, number>;

/** One 03b preflight result as the published refusal lists it. */
export type PreflightEntry = Readonly<{
  category: string;
  outcome: string;
  reason: string | null;
}>;

const NO_FALLBACK_REASONS: readonly string[] = CMS_LOCALE_NO_FALLBACK_REASONS;

/**
 * P2-S12-AC-051: `cms_no_fallback_block_total{reason}` counts blocking evaluations of the
 * `cms.locale.no_fallback_gate` provider, i.e. a `locale` category that failed with one of its three closed
 * reasons (BE03c 1556). A passed or unavailable entry, another category and an unknown reason count nothing.
 */
export const noFallbackBlockMetrics = (
  entries: readonly PreflightEntry[],
): Counters => {
  const counters: Counters = {};
  for (const entry of entries) {
    if (
      entry.category !== 'locale' ||
      entry.outcome !== 'failed' ||
      entry.reason === null ||
      !NO_FALLBACK_REASONS.includes(entry.reason)
    )
      continue;
    const key = metricKey('cms_no_fallback_block_total', {
      reason: entry.reason,
    });
    counters[key] = (counters[key] ?? 0) + 1;
  }
  return counters;
};
