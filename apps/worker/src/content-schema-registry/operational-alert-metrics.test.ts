import { describe, expect, it } from 'vitest';

import { buildContentSchemaRegistryOperationalSnapshot } from './operational-alert-metrics';

const at = (timestamp: string, source: Record<string, unknown>) => ({
  source: { ...source, timestamp },
});

describe('content schema registry operational metrics', () => {
  it('derives redacted alert and SLO measurements from structured production events', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    const events = [
      at('2026-09-05T11:58:00.000Z', {
        eventName: 'cms.registry.command',
        durationMs: 900,
        outcome: 'success',
      }),
      at('2026-09-05T11:59:00.000Z', {
        eventName: 'cms.registry.command',
        durationMs: 1_300,
        errorCode: 'VERSION_CONFLICT',
        outcome: 'rejected',
      }),
      at('2026-09-05T11:59:10.000Z', {
        eventName: 'cms.registry.rpc',
        durationMs: 350,
        outcome: 'success',
      }),
      at('2026-09-05T11:59:20.000Z', {
        eventName: 'cms.registry.acceptance',
        durationMs: 1_100,
        outcome: 'success',
      }),
      at('2026-09-05T11:59:30.000Z', {
        eventName: 'cms.registry.queue_attempt',
        durationMs: 61_000,
        attempt: 1,
        outcome: 'success',
      }),
      at('2026-09-05T11:59:40.000Z', {
        eventName: 'cms.registry.migration',
        attempt: 4,
        errorCode: 'UNKNOWN_EVENT_VERSION',
        metrics: { 'cms.migration.dlq.total': 1 },
        outcome: 'failure',
        retryable: true,
      }),
      at('2026-09-05T11:59:45.000Z', {
        eventName: 'cms.registry.request',
        errorCode: 'NONCE_REJECTED',
        outcome: 'rejected',
      }),
      at('2026-09-05T11:53:00.000Z', {
        eventName: 'cms.registry.request',
        errorCode: 'NONCE_REJECTED',
        outcome: 'rejected',
      }),
    ];

    expect(
      buildContentSchemaRegistryOperationalSnapshot({
        database: { activationBlockedMs: 900_001, outboxAgeMs: 120_001 },
        dlqDepth: 2,
        events,
        now,
      }),
    ).toEqual({
      acceptanceP99Ms: 1_100,
      assignmentDenialBaseline: 0,
      assignmentDenialRate: 0,
      capabilityGrantDenialBaseline: 0,
      capabilityGrantDenialRate: 0,
      decisionDenialBaseline: 0,
      decisionDenialRate: 0,
      activationBlockedMs: 900_001,
      commandP95Ms: 1_300,
      conflictRate: 0.5,
      conflictWindowMs: 300_000,
      dailyDlqRate: 1,
      dlqDepth: 2,
      migrationRetryCount: 4,
      nonceRejectionBaseline: 1,
      nonceRejectionRate: 1,
      outboxAgeMs: 120_001,
      protectedRpcP95Ms: 350,
      queueFirstAttemptP95Ms: 61_000,
      unknownEventVersions: 1,
    });
  });

  it('uses the authoritative migration DLQ total below the retry threshold', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    const snapshot = buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: [
        at('2026-09-05T11:59:00.000Z', {
          eventName: 'cms.registry.queue_attempt',
          attempt: 1,
          outcome: 'success',
        }),
        at('2026-09-05T11:59:10.000Z', {
          eventName: 'cms.registry.migration',
          attempt: 1,
          metrics: { 'cms.migration.dlq.total': 1 },
          outcome: 'success',
          retryable: false,
        }),
      ],
      now,
    });

    expect(snapshot.dailyDlqRate).toBe(1);
  });

  it('does not fall back to the retry-attempt heuristic when the authoritative total is zero', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    const snapshot = buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: [
        at('2026-09-05T11:59:00.000Z', {
          eventName: 'cms.registry.queue_attempt',
          attempt: 1,
          outcome: 'success',
        }),
        at('2026-09-05T11:59:10.000Z', {
          eventName: 'cms.registry.migration',
          attempt: 4,
          metrics: { 'cms.migration.dlq.total': 0 },
          outcome: 'failure',
          retryable: true,
        }),
      ],
      now,
    });

    expect(snapshot.dailyDlqRate).toBe(0);
  });

  it('omits the daily DLQ rate when the authoritative total is malformed', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    const snapshot = buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: [
        at('2026-09-05T11:59:00.000Z', {
          eventName: 'cms.registry.queue_attempt',
          attempt: 1,
          outcome: 'success',
        }),
        at('2026-09-05T11:59:10.000Z', {
          eventName: 'cms.registry.migration',
          attempt: 4,
          metrics: { 'cms.migration.dlq.total': '1' },
          outcome: 'failure',
          retryable: true,
        }),
      ],
      now,
    });

    expect(snapshot).not.toHaveProperty('dailyDlqRate');
  });

  it('omits measurements that cannot be established from finite provider data', () => {
    expect(
      buildContentSchemaRegistryOperationalSnapshot({
        database: {},
        events: [
          { source: 'not-structured' },
          { source: { durationMs: NaN } },
          { source: { timestamp: 'not-a-time' } },
        ],
        now: Date.parse('2026-09-05T12:00:00.000Z'),
      }),
    ).toEqual({
      assignmentDenialBaseline: 0,
      assignmentDenialRate: 0,
      capabilityGrantDenialBaseline: 0,
      capabilityGrantDenialRate: 0,
      decisionDenialBaseline: 0,
      decisionDenialRate: 0,
      conflictWindowMs: 300_000,
      nonceRejectionBaseline: 0,
      nonceRejectionRate: 0,
      unknownEventVersions: 0,
    });
  });
});

const command = (
  timestamp: string,
  operationId: string,
  status: number,
  eventName = 'cms.registry.command',
) =>
  at(timestamp, {
    eventName,
    operation: `cms.registry.${operationId}`,
    outcome: status >= 500 ? 'failure' : status >= 400 ? 'rejected' : 'success',
    metrics: { request_status: status },
    durationMs: 10,
  });

describe('[P2-S09-AC-693] review open age', () => {
  const now = Date.parse('2026-10-02T12:00:00.000Z');
  it('passes the database review age through', () => {
    expect(
      buildContentSchemaRegistryOperationalSnapshot({
        database: { reviewOpenAgeMs: 700_000_000 },
        events: [],
        now,
      }).reviewOpenAgeMs,
    ).toBe(700_000_000);
  });

  it.each([
    ['absent', {}],
    ['negative', { reviewOpenAgeMs: -1 }],
    ['not finite', { reviewOpenAgeMs: Number.POSITIVE_INFINITY }],
  ])('omits the age when it is %s', (_label, database) => {
    expect(
      'reviewOpenAgeMs' in
        buildContentSchemaRegistryOperationalSnapshot({
          database,
          events: [],
          now,
        }),
    ).toBe(false);
  });
});

describe('[P2-S09-AC-694] denial counts', () => {
  const now = Date.parse('2026-10-02T12:00:00.000Z');
  const snapshot = (events: readonly unknown[]) =>
    buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: events as never,
      now,
    });

  it('is zero in both windows when there is no command event', () => {
    expect(snapshot([])).toMatchObject({
      decisionDenialRate: 0,
      decisionDenialBaseline: 0,
      assignmentDenialRate: 0,
      assignmentDenialBaseline: 0,
      capabilityGrantDenialRate: 0,
      capabilityGrantDenialBaseline: 0,
    });
  });

  it('counts 401, 403 and 404 command outcomes per family in the current and preceding five minutes', () => {
    const result = snapshot([
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 403),
      command('2026-10-02T11:58:00.000Z', 'CMS-03A-12', 404),
      command('2026-10-02T11:57:00.000Z', 'CMS-03A-12', 401),
      command('2026-10-02T11:54:00.000Z', 'CMS-03A-12', 403),
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-14', 403),
      command('2026-10-02T11:52:00.000Z', 'CMS-03A-14', 404),
      command('2026-10-02T11:51:00.000Z', 'CMS-03A-14', 403),
      command('2026-10-02T11:59:30.000Z', 'CMS-03A-15', 403),
      command('2026-10-02T11:59:20.000Z', 'CMS-03A-16', 404),
      command('2026-10-02T11:59:10.000Z', 'CMS-03A-17', 401),
      command('2026-10-02T11:53:00.000Z', 'CMS-03A-15', 403),
    ]);
    expect(result).toMatchObject({
      decisionDenialRate: 3,
      decisionDenialBaseline: 1,
      assignmentDenialRate: 1,
      assignmentDenialBaseline: 2,
      capabilityGrantDenialRate: 3,
      capabilityGrantDenialBaseline: 1,
    });
  });

  it('ignores successes, conflicts, validation and server failures, other operations, other event names and older events', () => {
    const result = snapshot([
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 200),
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 409),
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 422),
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 503),
      command('2026-10-02T11:59:00.000Z', 'CMS-03A-11', 403),
      command(
        '2026-10-02T11:59:00.000Z',
        'CMS-03A-12',
        403,
        'cms.registry.rpc',
      ),
      command(
        '2026-10-02T11:59:00.000Z',
        'CMS-03A-12',
        403,
        'cms.registry.acceptance',
      ),
      command('2026-10-02T11:30:00.000Z', 'CMS-03A-12', 403),
      at('2026-10-02T11:59:00.000Z', {
        eventName: 'cms.registry.command',
        operation: 'cms.registry.CMS-03A-12',
        metrics: { request_status: '403' },
      }),
      at('2026-10-02T11:59:00.000Z', {
        eventName: 'cms.registry.command',
        operation: 7,
        metrics: { request_status: 403 },
      }),
      at('2026-10-02T11:59:00.000Z', {
        eventName: 'cms.registry.command',
        operation: 'cms.registry.CMS-03A-12',
      }),
    ]);
    expect(result).toMatchObject({
      decisionDenialRate: 0,
      decisionDenialBaseline: 0,
      assignmentDenialRate: 0,
      capabilityGrantDenialRate: 0,
    });
  });

  it('feeds the alert evaluator: a denial spike and a stale review raise their codes', async () => {
    const { evaluateContentSchemaRegistryAlerts } =
      await import('@wejammin/observability/content-schema-registry-alerts');
    const built = buildContentSchemaRegistryOperationalSnapshot({
      database: { reviewOpenAgeMs: 8 * 86_400_000 },
      events: [
        command('2026-10-02T11:59:00.000Z', 'CMS-03A-12', 403),
        command('2026-10-02T11:59:10.000Z', 'CMS-03A-14', 404),
        command('2026-10-02T11:59:20.000Z', 'CMS-03A-15', 403),
      ] as never,
      now,
    });
    expect(
      evaluateContentSchemaRegistryAlerts(built)
        .map((alert) => alert.code)
        .sort(),
    ).toEqual(
      [
        'assignment_denial_spike',
        'capability_grant_denial_spike',
        'decision_denial_spike',
        'review_open_past_window',
      ].sort(),
    );
  });
});
