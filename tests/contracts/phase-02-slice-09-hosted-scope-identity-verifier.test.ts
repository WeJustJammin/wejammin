/**
 * DEC-104 hosted-scope identity verifier (RED phase).
 *
 * DEC-104 (2026-09-25) authorizes a hosted-only expected identity that omits
 * `productionDeploymentId`/`productionDeployedAt`, so AC265/AC266 acceptance
 * can be verified on staging without the production-bound sidecar. This suite
 * states the identity/binding half of that route:
 *
 *   `validateContentSchemaRegistryOperationalHostedReleaseEvidence(evidence,
 *    expectedIdentity, now?)` returns the parsed hosted evidence or throws one
 *   sanitized error that never echoes the values it rejected.
 *
 * The module under test does not exist yet, so this suite is expected to fail
 * at import time. It adds no obligation and relaxes none: the shape/temporal
 * members reused here (`artifact`, `hostedE2e`, `accessibility`,
 * `verifiedAt`) keep their locked production semantics.
 */

import { describe, expect, it } from 'vitest';

import { validateContentSchemaRegistryOperationalHostedReleaseEvidence } from '../../infra/workflows/content-schema-registry-hosted-scope-identity-verifier.ts';
import {
  completeEvidence,
  expectedIdentity,
} from './phase-02-slice-09-operational-release-evidence.test-support.ts';

/**
 * The three-argument contract, declared as a cast so the suite compiles before
 * the module lands. The implementation is expected to narrow this signature.
 */
const validateHosted =
  validateContentSchemaRegistryOperationalHostedReleaseEvidence as (
    evidence: unknown,
    expectedIdentity: unknown,
    now?: () => number,
  ) => unknown;

type HostedRecord = Record<string, unknown>;

/** Exactly the four hosted members, reused from the locked production fixture. */
const hostedEvidence = (): HostedRecord => ({
  artifact: { ...completeEvidence.artifact },
  hostedE2e: { ...completeEvidence.hostedE2e },
  accessibility: {
    ...completeEvidence.accessibility,
    manualRuns: completeEvidence.accessibility.manualRuns.map((run) => ({
      ...run,
    })),
  },
  verifiedAt: completeEvidence.verifiedAt,
});

/** The hosted-only identity: the locked identity minus the two production members. */
const hostedIdentity = (): HostedRecord => ({
  sourceRevision: expectedIdentity.sourceRevision,
  artifactDigest: expectedIdentity.artifactDigest,
  buildId: expectedIdentity.buildId,
  migrationVersion: expectedIdentity.migrationVersion,
  hostedEnvironment: expectedIdentity.hostedEnvironment,
  hostedDeploymentId: expectedIdentity.hostedDeploymentId,
  hostedDeployedAt: expectedIdentity.hostedDeployedAt,
  webOrigin: expectedIdentity.webOrigin,
  apiOrigin: expectedIdentity.apiOrigin,
  supabaseOrigin: expectedIdentity.supabaseOrigin,
  trustedCutoffAt: expectedIdentity.trustedCutoffAt,
});

const withHostedE2e = (
  evidence: HostedRecord,
  patch: HostedRecord,
): HostedRecord => ({
  ...evidence,
  hostedE2e: {
    ...(evidence['hostedE2e'] as HostedRecord),
    ...patch,
  },
});

const withManualRun = (
  evidence: HostedRecord,
  index: number,
  patch: HostedRecord,
): HostedRecord => {
  const accessibility = evidence['accessibility'] as HostedRecord;
  const manualRuns = accessibility['manualRuns'] as readonly HostedRecord[];
  return {
    ...evidence,
    accessibility: {
      ...accessibility,
      manualRuns: manualRuns.map((run, runIndex) =>
        runIndex === index ? { ...run, ...patch } : run,
      ),
    },
  };
};

/** Trusted clock after the pinned cutoff (cutoff is `2026-09-03T12:20:00.000Z`). */
const trustedNow = (): number => Date.parse('2026-09-03T12:30:00.000Z');

/**
 * A sanitized failure echoes no rejected input: no 40-hex revision, no 64-hex
 * digest, and no origin. The message must also be bounded and non-empty.
 */
const ECHOED_INPUT = /[0-9a-f]{40}|[0-9a-f]{64}|https:\/\//iu;

const expectSanitizedRejection = (
  caseLabel: string,
  evidence: unknown,
  identity: unknown,
  now: () => number = trustedNow,
): void => {
  let thrown: unknown;
  try {
    validateHosted(evidence, identity, now);
  } catch (error: unknown) {
    thrown = error;
  }
  expect(thrown, `${caseLabel} must be rejected`).toBeInstanceOf(Error);
  if (!(thrown instanceof Error)) return;
  expect(
    thrown.message.length,
    `${caseLabel} message must be non-empty`,
  ).toBeGreaterThan(0);
  expect(
    thrown.message.length,
    `${caseLabel} message must stay bounded`,
  ).toBeLessThanOrEqual(256);
  expect(
    thrown.message,
    `${caseLabel} message must not echo rejected input`,
  ).not.toMatch(ECHOED_INPUT);
};

describe('Slice 09 DEC-104 hosted-scope identity verifier', () => {
  it('accepts the four hosted members against a hosted-only identity', () => {
    const evidence = hostedEvidence();
    const parsed = validateHosted(evidence, hostedIdentity(), trustedNow);
    expect(parsed).toEqual(evidence);
    expect(Object.keys(parsed as HostedRecord).sort()).toEqual([
      'accessibility',
      'artifact',
      'hostedE2e',
      'verifiedAt',
    ]);
  });

  it('accepts the same pair when the trusted clock is defaulted', () => {
    const evidence = hostedEvidence();
    expect(validateHosted(evidence, hostedIdentity())).toEqual(evidence);
  });

  it('rejects an identity that disagrees with the evidence on any bound member', () => {
    const mismatches: readonly (readonly [string, HostedRecord])[] = [
      ['artifact source SHA', { sourceRevision: 'c'.repeat(40) }],
      ['artifact digest', { artifactDigest: 'd'.repeat(64) }],
      ['artifact build id', { buildId: 'ci-33469999999' }],
      ['artifact migration version', { migrationVersion: '20260903990000' }],
      ['hosted environment', { hostedEnvironment: 'production' }],
      [
        'hosted deployment id',
        { hostedDeploymentId: 'deployment-99999999999' },
      ],
      ['hosted web origin', { webOrigin: 'https://staging.example.invalid' }],
      ['hosted api origin', { apiOrigin: 'https://api.example.invalid' }],
      [
        'hosted supabase origin',
        { supabaseOrigin: 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co' },
      ],
    ];

    for (const [field, override] of mismatches)
      expectSanitizedRejection(`identity ${field} mismatch`, hostedEvidence(), {
        ...hostedIdentity(),
        ...override,
      });
  });

  it('rejects evidence whose own hostedE2e record contradicts the artifact SHA', () => {
    expectSanitizedRejection(
      'evidence hostedE2e source revision mismatch',
      withHostedE2e(hostedEvidence(), { sourceRevision: 'c'.repeat(40) }),
      hostedIdentity(),
    );
  });

  it('rejects a hosted identity whose deployment follows the trusted cutoff', () => {
    expectSanitizedRejection(
      'hosted deployment after cutoff',
      hostedEvidence(),
      {
        ...hostedIdentity(),
        hostedDeployedAt: '2026-09-03T12:20:00.001Z',
      },
    );
  });

  it('rejects a hosted identity with a future trusted cutoff', () => {
    expectSanitizedRejection('future trusted cutoff', hostedEvidence(), {
      ...hostedIdentity(),
      trustedCutoffAt: '2026-09-03T12:40:00.000Z',
    });
  });

  it('rejects an invalid trusted clock', () => {
    for (const invalidClock of [
      () => Number.NaN,
      () => Number.POSITIVE_INFINITY,
    ])
      expectSanitizedRejection(
        'invalid trusted clock',
        hostedEvidence(),
        hostedIdentity(),
        invalidClock,
      );
  });

  it('rejects evidence retained before the hosted deployment', () => {
    expectSanitizedRejection(
      'hosted e2e before deployment',
      withHostedE2e(hostedEvidence(), {
        completedAt: '2026-09-03T09:59:59.999Z',
      }),
      hostedIdentity(),
    );

    for (const index of [0, 1])
      expectSanitizedRejection(
        `manual run ${index} before deployment`,
        withManualRun(hostedEvidence(), index, {
          completedAt: '2026-09-03T09:59:59.999Z',
        }),
        hostedIdentity(),
      );
  });

  it('rejects verification after the trusted cutoff', () => {
    expectSanitizedRejection(
      'verified after cutoff',
      { ...hostedEvidence(), verifiedAt: '2026-09-03T12:20:00.001Z' },
      hostedIdentity(),
    );
  });

  it('rejects a retained evidence timestamp after the trusted cutoff', () => {
    for (const index of [0, 1])
      expectSanitizedRejection(
        `manual run ${index} after cutoff`,
        withManualRun(hostedEvidence(), index, {
          completedAt: '2026-09-03T12:25:00.000Z',
        }),
        hostedIdentity(),
      );
  });

  it('rejects production-only members on either side of the call', () => {
    expectSanitizedRejection(
      'evidence carrying alerting',
      { ...hostedEvidence(), alerting: completeEvidence.alerting },
      hostedIdentity(),
    );
    expectSanitizedRejection(
      'evidence carrying slo',
      { ...hostedEvidence(), slo: completeEvidence.slo },
      hostedIdentity(),
    );
    expectSanitizedRejection(
      'identity carrying productionDeploymentId',
      hostedEvidence(),
      {
        ...hostedIdentity(),
        productionDeploymentId: expectedIdentity.productionDeploymentId,
      },
    );
    expectSanitizedRejection(
      'identity carrying productionDeployedAt',
      hostedEvidence(),
      {
        ...hostedIdentity(),
        productionDeployedAt: expectedIdentity.productionDeployedAt,
      },
    );
  });

  it('[P2-S09-AC-265] stays staging-scope: an internally consistent production target is rejected', () => {
    // The reused member schema permits 'production' so the production sidecar
    // can share it. This route is staging-scope by DEC-104/DEC-105, so a
    // self-consistent production target must still fail closed. Every
    // cross-member binding holds here, which is the point: only the scope gate
    // can reject it.
    const accessibility = hostedEvidence()['accessibility'] as HostedRecord;
    const productionEvidence: HostedRecord = {
      ...withHostedE2e(hostedEvidence(), { environment: 'production' }),
      accessibility: { ...accessibility, environment: 'production' },
    };
    const productionIdentity: HostedRecord = {
      ...hostedIdentity(),
      hostedEnvironment: 'production',
    };

    // Preconditions: the payload is internally consistent, so a mismatch
    // check alone could not reject it.
    expect(
      (productionEvidence['hostedE2e'] as HostedRecord)['environment'],
    ).toBe(
      (productionEvidence['accessibility'] as HostedRecord)['environment'],
    );
    expect(
      (productionEvidence['hostedE2e'] as HostedRecord)['environment'],
    ).toBe(productionIdentity['hostedEnvironment']);

    expectSanitizedRejection(
      'internally consistent production target',
      productionEvidence,
      productionIdentity,
    );
  });
});
