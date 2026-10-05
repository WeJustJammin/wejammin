import { describe, expect, it } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS,
  evaluateContentSchemaRegistryAlerts,
} from './content-schema-registry-alerts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('[P2-S09-AC-693] review open past its expected window alert', () => {
  it('derives the expected window from the seven-day assignment maximum (BE03a CMS-03A-14)', () => {
    expect(
      CONTENT_SCHEMA_REGISTRY_REVIEW_ALERT_THRESHOLDS.reviewOpenWindowMs,
    ).toBe(SEVEN_DAYS_MS);
  });

  it('pages when a review has been open longer than the window', () => {
    const alerts = evaluateContentSchemaRegistryAlerts({
      reviewOpenAgeMs: SEVEN_DAYS_MS + 1,
    });
    expect(alerts).toEqual([
      {
        code: 'review_open_past_window',
        observed: SEVEN_DAYS_MS + 1,
        threshold: SEVEN_DAYS_MS,
        route: 'platform.on_call',
        runbook: 'content-schema-registry',
      },
    ]);
  });

  it('does not page at or below the window, when absent, or on malformed input', () => {
    for (const reviewOpenAgeMs of [
      0,
      SEVEN_DAYS_MS,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
      expect(evaluateContentSchemaRegistryAlerts({ reviewOpenAgeMs })).toEqual(
        [],
      );
    expect(evaluateContentSchemaRegistryAlerts({})).toEqual([]);
  });
});

describe('[P2-S09-AC-694] decision, assignment and capability-grant denial spike alerts', () => {
  it.each([
    [
      'decision_denial_spike',
      { decisionDenialRate: 5, decisionDenialBaseline: 4 },
      5,
      4,
    ],
    [
      'assignment_denial_spike',
      { assignmentDenialRate: 3, assignmentDenialBaseline: 2 },
      3,
      2,
    ],
    [
      'capability_grant_denial_spike',
      { capabilityGrantDenialRate: 1, capabilityGrantDenialBaseline: 0 },
      1,
      0,
    ],
  ] as const)(
    'pages %s when the current window exceeds the baseline',
    (code, patch, observed, threshold) => {
      expect(evaluateContentSchemaRegistryAlerts(patch)).toEqual([
        {
          code,
          observed,
          threshold,
          route: 'platform.on_call',
          runbook: 'content-schema-registry',
        },
      ]);
    },
  );

  it('does not page at baseline, below it, with a missing side, or on malformed input', () => {
    expect(
      evaluateContentSchemaRegistryAlerts({
        decisionDenialRate: 4,
        decisionDenialBaseline: 4,
        assignmentDenialRate: 0,
        assignmentDenialBaseline: 2,
        capabilityGrantDenialRate: 9,
      }),
    ).toEqual([]);
    expect(
      evaluateContentSchemaRegistryAlerts({
        decisionDenialRate: Number.NaN,
        decisionDenialBaseline: 0,
        assignmentDenialRate: Number.POSITIVE_INFINITY,
        assignmentDenialBaseline: 0,
      }),
    ).toEqual([]);
  });

  it('pages each denial family independently', () => {
    const codes = evaluateContentSchemaRegistryAlerts({
      decisionDenialRate: 2,
      decisionDenialBaseline: 1,
      assignmentDenialRate: 2,
      assignmentDenialBaseline: 1,
      capabilityGrantDenialRate: 2,
      capabilityGrantDenialBaseline: 1,
    }).map((entry) => entry.code);
    expect(codes).toEqual([
      'decision_denial_spike',
      'assignment_denial_spike',
      'capability_grant_denial_spike',
    ]);
  });
});
