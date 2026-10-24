import { describe, expect, it } from 'vitest';

import { evaluateAndEmitCmsCompositionAlerts } from '../../infra/observability/cms-composition-alert-boundary';
import {
  CMS_COMPOSITION_ALERT_CODES,
  CMS_COMPOSITION_ALERT_THRESHOLDS,
  evaluateCmsCompositionAlerts,
  type CmsCompositionOperationalSnapshot,
} from '../../infra/observability/cms-composition-alert-policy';
import { CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS } from '../../infra/observability/content-schema-registry-alert-policy';

/*
 * [P2-S12-AC-264] BE03c Observability: "Alert on DLQ >0, outbox age >2m, activation blocked >15m, stale
 * locale legal-field count >0, or target-filter anomaly." DEC-219/DEC-220 add a sixth: a failed locale observability
 * read (the stale legal-field alert input would otherwise disappear silently); it is stateless, one failed read
 * raises it for that firing. The first three share the locked Slice 09
 * numbers (BE03a Observability states the same two minutes and fifteen minutes); the last two are new.
 * Missing measurements never alert, like the Slice 09 policy.
 */

const healthy: CmsCompositionOperationalSnapshot = {
  dlqDepth: 0,
  outboxAgeMs: CMS_COMPOSITION_ALERT_THRESHOLDS.outboxAgeMs,
  activationBlockedMs: CMS_COMPOSITION_ALERT_THRESHOLDS.activationBlockedMs,
  staleLocaleLegalFieldCount: 0,
  localeObservabilityFailedReads: 0,
  targetFilterCount: 4,
  targetFilterBaseline: 4,
};

describe('[P2-S12-AC-264] composition alert thresholds', () => {
  it('pins the six named conditions and their numbers in one executable policy', () => {
    expect(CMS_COMPOSITION_ALERT_THRESHOLDS).toEqual({
      dlqDepth: 0,
      outboxAgeMs: 120_000,
      activationBlockedMs: 900_000,
      staleLocaleLegalFieldCount: 0,
      // DEC-220: a failed locale observability read alerts for its own firing (strictly above zero).
      localeObservabilityFailedReads: 0,
    });
    expect([...CMS_COMPOSITION_ALERT_CODES].sort()).toEqual([
      'activation_blocked',
      'dlq_nonempty',
      'locale_observability_unavailable',
      'outbox_age_exceeded',
      'stale_locale_legal_fields',
      'target_filter_anomaly',
    ]);
  });

  it('shares the Slice 09 numbers for outbox age and a blocked activation instead of restating them', () => {
    expect(CMS_COMPOSITION_ALERT_THRESHOLDS.outboxAgeMs).toBe(
      CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.outboxAgeMs,
    );
    expect(CMS_COMPOSITION_ALERT_THRESHOLDS.activationBlockedMs).toBe(
      CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.activationBlockedMs,
    );
  });
});

describe('[P2-S12-AC-264] composition alert evaluation', () => {
  it('raises nothing for a healthy snapshot, at every strict boundary', () => {
    expect(evaluateCmsCompositionAlerts(healthy)).toEqual([]);
    expect(evaluateCmsCompositionAlerts({})).toEqual([]);
  });

  it.each([
    ['dlq_nonempty', { dlqDepth: 1 }, 1, 0],
    ['outbox_age_exceeded', { outboxAgeMs: 120_001 }, 120_001, 120_000],
    ['activation_blocked', { activationBlockedMs: 900_001 }, 900_001, 900_000],
    ['stale_locale_legal_fields', { staleLocaleLegalFieldCount: 1 }, 1, 0],
    [
      'locale_observability_unavailable',
      { localeObservabilityFailedReads: 1 },
      1,
      0,
    ],
    [
      'target_filter_anomaly',
      { targetFilterCount: 5, targetFilterBaseline: 4 },
      5,
      4,
    ],
  ] as const)(
    'pages the exact %s condition once, to the on-call route and the composition runbook',
    (code, patch, observed, threshold) => {
      const alerts = evaluateCmsCompositionAlerts({ ...healthy, ...patch });
      expect(alerts).toEqual([
        {
          code,
          observed,
          threshold,
          route: 'platform.on_call',
          runbook: 'cms-composition',
        },
      ]);
    },
  );

  it('raises several conditions together, in the named order', () => {
    const alerts = evaluateCmsCompositionAlerts({
      dlqDepth: 2,
      outboxAgeMs: 300_000,
      activationBlockedMs: 1_000_000,
      staleLocaleLegalFieldCount: 3,
      localeObservabilityFailedReads: 1,
      targetFilterCount: 9,
      targetFilterBaseline: 1,
    });
    expect(alerts.map((alert) => alert.code)).toEqual([
      'dlq_nonempty',
      'outbox_age_exceeded',
      'activation_blocked',
      'stale_locale_legal_fields',
      'locale_observability_unavailable',
      'target_filter_anomaly',
    ]);
  });

  it('does not treat a target-filter count equal to or below its baseline as an anomaly', () => {
    for (const [count, baseline] of [
      [4, 4],
      [0, 0],
      [3, 4],
    ] as const)
      expect(
        evaluateCmsCompositionAlerts({
          targetFilterCount: count,
          targetFilterBaseline: baseline,
        }),
      ).toEqual([]);
  });

  it('does not alert on a missing, non-finite or negative-free measurement it cannot compare', () => {
    expect(
      evaluateCmsCompositionAlerts({
        dlqDepth: Number.NaN,
        outboxAgeMs: Number.POSITIVE_INFINITY,
        activationBlockedMs: Number.NaN,
        staleLocaleLegalFieldCount: Number.NaN,
        localeObservabilityFailedReads: Number.NaN,
        targetFilterCount: 9,
      }),
    ).toEqual([]);
    expect(evaluateCmsCompositionAlerts({ targetFilterBaseline: 1 })).toEqual(
      [],
    );
  });

  it('returns a frozen result whose entries cannot be altered by a caller', () => {
    const alerts = evaluateCmsCompositionAlerts({ dlqDepth: 1 });
    expect(Object.isFrozen(alerts)).toBe(true);
    expect(Object.isFrozen(alerts[0])).toBe(true);
  });
});

describe('[P2-S12-AC-264] DEC-220 failed locale observability reads', () => {
  it('does not alert for zero failed reads and alerts for one, with no window or history to satisfy', () => {
    expect(
      evaluateCmsCompositionAlerts({ localeObservabilityFailedReads: 0 }),
    ).toEqual([]);
    expect(
      evaluateCmsCompositionAlerts({ localeObservabilityFailedReads: 1 }),
    ).toEqual([
      {
        code: 'locale_observability_unavailable',
        observed: 1,
        threshold: 0,
        route: 'platform.on_call',
        runbook: 'cms-composition',
      },
    ]);
  });

  it('carries no failed-read window constant and no history helper (the policy is stateless)', () => {
    expect(Object.keys(CMS_COMPOSITION_ALERT_THRESHOLDS)).not.toContain(
      'localeObservabilityFailedReadWindowMs',
    );
  });
});

describe('[P2-S12-AC-264] provider-free delivery seam', () => {
  it('hands only page-worthy alert records to the caller-provided sink', () => {
    const emitted: string[] = [];
    const alerts = evaluateAndEmitCmsCompositionAlerts(
      { ...healthy, staleLocaleLegalFieldCount: 2 },
      (alert) => {
        emitted.push(`${alert.code}:${alert.observed}:${alert.threshold}`);
      },
    );
    expect(alerts).toHaveLength(1);
    expect(emitted).toEqual(['stale_locale_legal_fields:2:0']);
    expect(
      evaluateAndEmitCmsCompositionAlerts(healthy, () => {
        throw new Error('a healthy snapshot must emit nothing');
      }),
    ).toEqual([]);
  });
});
