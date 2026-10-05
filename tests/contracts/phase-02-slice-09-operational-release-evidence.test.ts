import { describe, expect, it } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS,
  ContentSchemaRegistryOperationalReleaseEvidenceSchema,
  ReleaseEvidenceHostedOriginSchema,
  ReleaseEvidenceHttpsOriginSchema,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import { validateContentSchemaRegistryOperationalReleaseEvidence } from '../../infra/workflows/verify-content-schema-registry-release-evidence.ts';
import {
  completeEvidence,
  expectedIdentity,
  expectedIdentityWithChronology,
  sourceRevision,
} from './phase-02-slice-09-operational-release-evidence.test-support.ts';

const expectIssue = (
  candidate: unknown,
  path: readonly (string | number)[],
  message: string,
): void => {
  const result =
    ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse(candidate);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: [...path], message }),
    ]),
  );
};

describe('Slice 09 operational release evidence contract', () => {
  it('accepts one complete same-artifact sidecar without secrets or PII', () => {
    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.parse(
        completeEvidence,
      ),
    ).toEqual(completeEvidence);
    expect(JSON.stringify(completeEvidence)).not.toMatch(
      /password|cookie|token|authorization|emailAddress/iu,
    );
  });

  it('[P2-S09-AC-211] requires a nonnegative integer production error count in the measured window', () => {
    const evidenceWithErrorCount = {
      ...completeEvidence,
      slo: {
        ...completeEvidence.slo,
        samples: { ...completeEvidence.slo.samples, errorCount: 0 },
      },
    };
    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.parse(
        evidenceWithErrorCount,
      ),
    ).toEqual(evidenceWithErrorCount);

    const expectInvalidErrorCount = (candidate: unknown): void => {
      const result =
        ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse(
          candidate,
        );
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['slo', 'samples', 'errorCount'],
          }),
        ]),
      );
    };

    for (const errorCount of [-1, 0.5]) {
      expectInvalidErrorCount({
        ...evidenceWithErrorCount,
        slo: {
          ...evidenceWithErrorCount.slo,
          samples: { ...evidenceWithErrorCount.slo.samples, errorCount },
        },
      });
    }

    const samplesWithoutErrorCount = Object.fromEntries(
      Object.entries(evidenceWithErrorCount.slo.samples).filter(
        ([key]) => key !== 'errorCount',
      ),
    );
    expectInvalidErrorCount({
      ...evidenceWithErrorCount,
      slo: {
        ...evidenceWithErrorCount.slo,
        samples: samplesWithoutErrorCount,
      },
    });
  });

  it('[P2-S09-AC-209] requires every configured alert and a real native provider', () => {
    expectIssue(
      {
        ...completeEvidence,
        alerting: {
          ...completeEvidence.alerting,
          configuredConditions: ['activation_blocked'],
        },
      },
      ['alerting', 'configuredConditions'],
      'All locked alert conditions must be configured exactly once',
    );
    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse({
        ...completeEvidence,
        alerting: { ...completeEvidence.alerting, provider: 'fake' },
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-209] [P2-S09-AC-693] [P2-S09-AC-694] locks the full canonical sixteen-condition alert set', () => {
    expect(CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS).toEqual([
      'activation_blocked',
      'migration_retry_exceeded',
      'nonce_rejection_spike',
      'dlq_nonempty',
      'outbox_age_exceeded',
      'conflict_rate_exceeded',
      'unknown_event_version',
      'command_p95_exceeded',
      'protected_rpc_p95_exceeded',
      'acceptance_p99_exceeded',
      'queue_first_attempt_p95_exceeded',
      'daily_dlq_rate_exceeded',
      'review_open_past_window',
      'decision_denial_spike',
      'assignment_denial_spike',
      'capability_grant_denial_spike',
    ]);
  });

  it('[P2-S09-AC-211] rejects threshold equality and a mismatched daily DLQ ratio', () => {
    expectIssue(
      {
        ...completeEvidence,
        slo: {
          ...completeEvidence.slo,
          samples: {
            ...completeEvidence.slo.samples,
            dlqMessages: 1,
          },
          observed: {
            ...completeEvidence.slo.observed,
            commandP95Ms: 1_200,
            dailyDlqRate: 0,
          },
        },
      },
      ['slo', 'observed', 'commandP95Ms'],
      'Command p95 must remain below 1200 ms',
    );
  });

  it('[P2-S09-AC-211] independently rejects a mismatched derived daily DLQ ratio', () => {
    expectIssue(
      {
        ...completeEvidence,
        slo: {
          ...completeEvidence.slo,
          samples: { ...completeEvidence.slo.samples, dlqMessages: 1 },
          observed: { ...completeEvidence.slo.observed, dailyDlqRate: 0 },
        },
      },
      ['slo', 'observed', 'dailyDlqRate'],
      'Daily DLQ rate must be derived from the retained production counts',
    );
  });

  it('[P2-S09-AC-265] requires all hosted roles/scenarios and forbids local IdP proof', () => {
    expectIssue(
      {
        ...completeEvidence,
        hostedE2e: {
          ...completeEvidence.hostedE2e,
          roles: ['owner_full'],
          scenarios: ['server_authoritative_rls'],
        },
      },
      ['hostedE2e', 'roles'],
      'All locked hosted role variants must pass exactly once',
    );
    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse({
        ...completeEvidence,
        hostedE2e: {
          ...completeEvidence.hostedE2e,
          idpProvider: 'email',
        },
      }).success,
    ).toBe(false);
    expectIssue(
      {
        ...completeEvidence,
        hostedE2e: {
          ...completeEvidence.hostedE2e,
          scenarios: ['server_authoritative_rls'],
        },
      },
      ['hostedE2e', 'scenarios'],
      'All locked hosted E2E scenarios must pass exactly once',
    );
  });

  it('[P2-S09-AC-266] requires both complete platform-specific manual runs', () => {
    const [voiceOver, nvda] = completeEvidence.accessibility.manualRuns;
    expectIssue(
      {
        ...completeEvidence,
        accessibility: {
          ...completeEvidence.accessibility,
          manualRuns: [
            { ...voiceOver, checks: ['keyboard'] },
            { ...nvda, checks: ['keyboard'] },
          ],
        },
      },
      ['accessibility', 'manualRuns', 0, 'checks'],
      'Every locked manual accessibility check must pass exactly once',
    );
  });

  it('rejects local environments, malformed release identity, and nonzero axe findings structurally', () => {
    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse({
        ...completeEvidence,
        artifact: {
          ...completeEvidence.artifact,
          sourceRevision: 'short',
        },
        alerting: {
          ...completeEvidence.alerting,
          environment: 'local',
        },
        accessibility: {
          ...completeEvidence.accessibility,
          axeSerious: 1,
        },
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-265] rejects hosted origins carrying paths, credentials, queries, or fragments', () => {
    expectIssue(
      {
        ...completeEvidence,
        hostedE2e: {
          ...completeEvidence.hostedE2e,
          webOrigin:
            'https://operator:secret@staging.wejamm.in/private?token=secret#result',
        },
      },
      ['hostedE2e', 'webOrigin'],
      'Hosted origins must be pathless HTTPS origins without credentials',
    );
    expect(
      ReleaseEvidenceHttpsOriginSchema.safeParse(
        'https://staging.wejamm.in/private',
      ).success,
    ).toBe(false);
    expect(() =>
      ReleaseEvidenceHttpsOriginSchema.safeParse('not-an-origin'),
    ).not.toThrow();
    expect(
      ReleaseEvidenceHttpsOriginSchema.safeParse('not-an-origin').success,
    ).toBe(false);
    expect(
      ReleaseEvidenceHostedOriginSchema.safeParse('not-an-origin').success,
    ).toBe(false);
    for (const webOrigin of [
      'https://localhost',
      'https://127.0.0.1',
      'https://192.168.1.20',
      'https://[::ffff:127.0.0.1]',
      'https://[::ffff:7f00:1]',
    ])
      expect(
        ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse({
          ...completeEvidence,
          hostedE2e: { ...completeEvidence.hostedE2e, webOrigin },
          accessibility: { ...completeEvidence.accessibility, webOrigin },
        }).success,
      ).toBe(false);
  });

  it('requires verification to occur after every retained evidence record', () => {
    expectIssue(
      { ...completeEvidence, verifiedAt: '2026-09-03T10:00:00.000Z' },
      ['verifiedAt'],
      'Verification must occur after every retained evidence record',
    );
  });

  it('binds the verified sidecar to an externally supplied full release SHA', async () => {
    const { validateContentSchemaRegistryOperationalReleaseEvidence } =
      await import('../../infra/workflows/verify-content-schema-registry-release-evidence.ts');
    const validateReleaseEvidence =
      validateContentSchemaRegistryOperationalReleaseEvidence as (
        evidence: unknown,
        expectedReleaseIdentity: unknown,
      ) => unknown;
    expect(
      validateReleaseEvidence(completeEvidence, expectedIdentity),
    ).toMatchObject({ artifact: { sourceRevision } });
    expect(() =>
      validateReleaseEvidence(completeEvidence, {
        ...expectedIdentity,
        sourceRevision: 'b'.repeat(40),
      }),
    ).toThrow('Release evidence does not match the expected source SHA');
    expect(() =>
      validateReleaseEvidence(completeEvidence, {
        ...expectedIdentity,
        artifactDigest: 'f'.repeat(64),
      }),
    ).toThrow('Release evidence does not match the expected artifact digest');
    expect(() =>
      validateReleaseEvidence(completeEvidence, {
        ...expectedIdentity,
        webOrigin: 'https://untrusted.wejamm.in',
      }),
    ).toThrow('Release evidence does not match the expected hosted target');
    expect(() =>
      validateReleaseEvidence(completeEvidence, {
        ...expectedIdentity,
        buildId: 'different-build',
      }),
    ).toThrow('Release evidence does not match the expected build identity');
    expect(() =>
      validateReleaseEvidence(completeEvidence, {
        ...expectedIdentity,
        productionDeploymentId: 'different-production',
      }),
    ).toThrow(
      'Release evidence does not match the expected production deployment',
    );
    expect(() => validateReleaseEvidence(completeEvidence, {})).toThrow(
      'Expected release identity is invalid',
    );
  });

  it('rejects a component report from a different artifact SHA', () => {
    expectIssue(
      {
        ...completeEvidence,
        slo: { ...completeEvidence.slo, sourceRevision: 'b'.repeat(40) },
      },
      ['artifact', 'sourceRevision'],
      'Every release evidence record must match the artifact SHA',
    );
  });

  it('rejects hosted evidence from a different migration version', () => {
    expectIssue(
      {
        ...completeEvidence,
        hostedE2e: {
          ...completeEvidence.hostedE2e,
          migrationVersion: '20260903120001',
        },
      },
      ['hostedE2e', 'migrationVersion'],
      'Hosted E2E evidence must match the artifact migration version',
    );
  });

  it('rejects an alert receipt dated before its production configuration', () => {
    expectIssue(
      {
        ...completeEvidence,
        alerting: {
          ...completeEvidence.alerting,
          deliveryReceipt: {
            ...completeEvidence.alerting.deliveryReceipt,
            deliveredAt: '2026-09-03T11:59:59.000Z',
          },
        },
      },
      ['alerting', 'deliveryReceipt', 'deliveredAt'],
      'Alert delivery must follow the captured production configuration',
    );
    expectIssue(
      {
        ...completeEvidence,
        alerting: {
          ...completeEvidence.alerting,
          deliveryReceipt: {
            ...completeEvidence.alerting.deliveryReceipt,
            deliveredAt: completeEvidence.alerting.capturedAt,
          },
        },
      },
      ['alerting', 'deliveryReceipt', 'deliveredAt'],
      'Alert delivery must follow the captured production configuration',
    );
  });

  it('rejects a reversed production SLO measurement window', () => {
    expectIssue(
      {
        ...completeEvidence,
        slo: {
          ...completeEvidence.slo,
          window: {
            startedAt: '2026-09-03T00:00:00.000Z',
            endedAt: '2026-09-02T00:00:00.000Z',
          },
        },
      },
      ['slo', 'window', 'endedAt'],
      'SLO window must end after it starts',
    );
  });

  it('[P2-S09-AC-211] requires one complete UTC day for retained DLQ evidence', () => {
    expectIssue(
      {
        ...completeEvidence,
        slo: {
          ...completeEvidence.slo,
          window: {
            startedAt: '2026-09-02T01:00:00.000Z',
            endedAt: '2026-09-03T01:00:00.000Z',
          },
        },
      },
      ['slo', 'window'],
      'SLO evidence must cover one complete UTC day',
    );
  });

  it('requires manual accessibility and hosted browser proof from the same environment', () => {
    expectIssue(
      {
        ...completeEvidence,
        accessibility: {
          ...completeEvidence.accessibility,
          environment: 'production',
        },
      },
      ['accessibility', 'environment'],
      'Accessibility and hosted E2E evidence must target the same environment',
    );
  });

  it('requires final verification to occur strictly after retained evidence', () => {
    expectIssue(
      {
        ...completeEvidence,
        verifiedAt: completeEvidence.alerting.deliveryReceipt.deliveredAt,
      },
      ['verifiedAt'],
      'Verification must occur after every retained evidence record',
    );
  });

  it('rejects alert evidence captured before the expected production deployment', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        {
          ...completeEvidence,
          alerting: {
            ...completeEvidence.alerting,
            capturedAt: '2026-08-31T23:59:59.999Z',
          },
        },
        expectedIdentityWithChronology,
      ),
    ).toThrow('Release evidence predates the expected production deployment');
  });

  it('rejects an SLO window that begins before the expected production deployment', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        {
          ...expectedIdentityWithChronology,
          productionDeployedAt: '2026-09-02T00:00:00.001Z',
        },
      ),
    ).toThrow('Release evidence predates the expected production deployment');
  });

  it('rejects hosted E2E evidence completed before the expected hosted deployment', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        {
          ...expectedIdentityWithChronology,
          hostedDeployedAt: '2026-09-03T11:00:00.001Z',
        },
      ),
    ).toThrow('Release evidence predates the expected hosted deployment');
  });

  it('rejects either manual accessibility run completed before the expected hosted deployment', () => {
    for (const index of [0, 1] as const) {
      expect(() =>
        validateContentSchemaRegistryOperationalReleaseEvidence(
          {
            ...completeEvidence,
            accessibility: {
              ...completeEvidence.accessibility,
              manualRuns: completeEvidence.accessibility.manualRuns.map(
                (run, runIndex) =>
                  runIndex === index
                    ? { ...run, completedAt: '2026-09-03T10:59:00.000Z' }
                    : run,
              ) as typeof completeEvidence.accessibility.manualRuns,
            },
          },
          {
            ...expectedIdentityWithChronology,
            hostedDeployedAt: '2026-09-03T11:00:00.000Z',
          },
        ),
      ).toThrow('Release evidence predates the expected hosted deployment');
    }
  });

  it('rejects final verification after the trusted evidence cutoff', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        { ...completeEvidence, verifiedAt: '2026-09-03T12:20:00.001Z' },
        expectedIdentityWithChronology,
      ),
    ).toThrow('Release evidence exceeds the trusted cutoff');
  });

  it('rejects an individual evidence timestamp after the trusted cutoff', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        {
          ...completeEvidence,
          hostedE2e: {
            ...completeEvidence.hostedE2e,
            completedAt: '2026-09-03T12:20:00.001Z',
          },
          verifiedAt: '2026-09-03T12:20:00.002Z',
        },
        expectedIdentityWithChronology,
      ),
    ).toThrow('Release evidence exceeds the trusted cutoff');
  });

  it('rejects expected deployment times after the trusted cutoff', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        {
          ...expectedIdentityWithChronology,
          productionDeployedAt: '2026-09-03T12:20:00.001Z',
        },
      ),
    ).toThrow('Expected release identity time bounds are invalid');
  });

  it('rejects a trusted cutoff after the injected trusted clock', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        expectedIdentityWithChronology,
        () => Date.parse('2026-09-03T12:19:59.999Z'),
      ),
    ).toThrow('Trusted release evidence cutoff is in the future');
  });

  it('accepts a trusted cutoff equal to the injected trusted clock', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        {
          ...expectedIdentityWithChronology,
          trustedCutoffAt: completeEvidence.verifiedAt,
        },
        () => Date.parse(completeEvidence.verifiedAt),
      ),
    ).not.toThrow();
  });

  it('rejects an invalid injected trusted clock', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        expectedIdentityWithChronology,
        () => Number.NaN,
      ),
    ).toThrow('Trusted release clock is invalid');
  });

  it('accepts deployment, evidence, and cutoff equality boundaries', () => {
    expect(() =>
      validateContentSchemaRegistryOperationalReleaseEvidence(
        completeEvidence,
        {
          ...expectedIdentityWithChronology,
          productionDeployedAt: completeEvidence.slo.window.startedAt,
          hostedDeployedAt: completeEvidence.hostedE2e.completedAt,
          trustedCutoffAt: completeEvidence.verifiedAt,
        },
      ),
    ).not.toThrow();
  });
});
