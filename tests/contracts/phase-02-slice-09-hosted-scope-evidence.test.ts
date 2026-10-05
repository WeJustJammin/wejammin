/**
 * DEC-104 hosted-scope acceptance contract.
 *
 * DEC-104 (2026-09-25) authorizes an additive hosted-scope evidence shape and a
 * hosted-only expected identity so AC265/AC266 can be verified on staging
 * without the production-bound `alerting`/`slo` members:
 *
 *   "add a hosted-scope evidence shape and hosted-only expected identity
 *    (`{artifact, hostedE2e, accessibility, verifiedAt}` without
 *    `productionDeploymentId`/`productionDeployedAt`) and route AC265 and
 *    AC266 acceptance through the retained hosted-report verifier plus the
 *    existing axe and manual verifiers. `alerting` and `slo` remain mandatory
 *    in the production sidecar for AC209 and AC211."
 *
 * The shape and hosted-only identity live in
 * `packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-scope.ts`;
 * this suite pins that contract. It adds no obligation and relaxes none: the
 * production sidecar is asserted here to remain unchanged and to keep rejecting
 * a sidecar that omits `alerting` or `slo`.
 */

import { describe, expect, it } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES,
  CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS,
  CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-common.ts';
import {
  OperationalHostedReleaseEvidenceExpectedIdentitySchema,
  OperationalHostedReleaseEvidenceShapeSchema,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-scope.ts';
import {
  ContentSchemaRegistryOperationalReleaseEvidenceSchema,
  OperationalReleaseEvidenceExpectedIdentitySchema,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import {
  completeEvidence,
  expectedIdentity,
} from './phase-02-slice-09-operational-release-evidence.test-support.ts';

/**
 * The hosted half of one complete sidecar: exactly the four members DEC-104
 * names, reusing the already-locked production member shapes verbatim.
 */
const hostedEvidence = {
  artifact: completeEvidence.artifact,
  hostedE2e: completeEvidence.hostedE2e,
  accessibility: completeEvidence.accessibility,
  verifiedAt: completeEvidence.verifiedAt,
};

/**
 * The hosted-only identity: the existing identity without the two
 * production-bound members. Every other member is retained verbatim so the
 * hosted route binds the same candidate identity the production route binds.
 */
const hostedIdentity = {
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
};

const expectRejectedAtPath = (
  candidate: unknown,
  path: readonly (string | number)[],
): void => {
  const result =
    OperationalHostedReleaseEvidenceShapeSchema.safeParse(candidate);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues.map((issue) => issue.path)).toEqual(
    expect.arrayContaining([path]),
  );
};

describe('Slice 09 DEC-104 hosted-scope acceptance contract', () => {
  it('accepts exactly the four hosted members and round-trips them unchanged', () => {
    expect(
      OperationalHostedReleaseEvidenceShapeSchema.parse(hostedEvidence),
    ).toEqual(hostedEvidence);
    expect(Object.keys(hostedEvidence).sort()).toEqual([
      'accessibility',
      'artifact',
      'hostedE2e',
      'verifiedAt',
    ]);
  });

  it('keeps the shape closed: no alerting, slo, or unknown member may appear', () => {
    for (const extra of [
      { alerting: completeEvidence.alerting },
      { slo: completeEvidence.slo },
      { productionDeploymentId: expectedIdentity.productionDeploymentId },
      { unknownMember: true },
    ]) {
      const result = OperationalHostedReleaseEvidenceShapeSchema.safeParse({
        ...hostedEvidence,
        ...extra,
      });
      expect(result.success, JSON.stringify(Object.keys(extra))).toBe(false);
    }

    for (const member of [
      'artifact',
      'hostedE2e',
      'accessibility',
      'verifiedAt',
    ] as const) {
      const withoutMember: Record<string, unknown> = { ...hostedEvidence };
      delete withoutMember[member];
      expect(
        OperationalHostedReleaseEvidenceShapeSchema.safeParse(withoutMember)
          .success,
        member,
      ).toBe(false);
    }
  });

  it('accepts a hosted-only identity and rejects the same object as a production identity', () => {
    expect(
      OperationalHostedReleaseEvidenceExpectedIdentitySchema.parse(
        hostedIdentity,
      ),
    ).toEqual(hostedIdentity);
    expect(Object.hasOwn(hostedIdentity, 'productionDeploymentId')).toBe(false);
    expect(Object.hasOwn(hostedIdentity, 'productionDeployedAt')).toBe(false);

    const production =
      OperationalReleaseEvidenceExpectedIdentitySchema.safeParse(
        hostedIdentity,
      );
    expect(production.success).toBe(false);
    if (production.success) return;
    expect(production.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        ['productionDeploymentId'],
        ['productionDeployedAt'],
      ]),
    );
  });

  it('requires every retained hosted-identity field: omitting any one fails', () => {
    // The identity differs from production by exactly two omitted members.
    // This executes that claim field-by-field, so "omit only the two production
    // fields" cannot silently degrade into "omit anything".
    const retainedFields = [
      'sourceRevision',
      'artifactDigest',
      'buildId',
      'migrationVersion',
      'hostedEnvironment',
      'hostedDeploymentId',
      'hostedDeployedAt',
      'webOrigin',
      'apiOrigin',
      'supabaseOrigin',
      'trustedCutoffAt',
    ] as const;

    expect(Object.keys(hostedIdentity).sort()).toEqual(
      [...retainedFields].sort(),
    );
    expect(retainedFields).toHaveLength(11);

    for (const field of retainedFields) {
      const withoutField: Record<string, unknown> = { ...hostedIdentity };
      delete withoutField[field];
      const result =
        OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse(
          withoutField,
        );
      expect(result.success, `missing ${field}`).toBe(false);
      if (result.success) continue;
      expect(
        result.error.issues.map((issue) => issue.path),
        `missing ${field}`,
      ).toEqual(expect.arrayContaining([[field]]));
    }
  });

  it('rejects a hosted identity carrying either production member', () => {
    for (const extra of [
      { productionDeploymentId: expectedIdentity.productionDeploymentId },
      { productionDeployedAt: expectedIdentity.productionDeployedAt },
    ]) {
      expect(
        OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse({
          ...hostedIdentity,
          ...extra,
        }).success,
        JSON.stringify(Object.keys(extra)),
      ).toBe(false);
    }
  });

  it('requires every retained hosted identity member', () => {
    for (const member of Object.keys(hostedIdentity)) {
      const withoutMember: Record<string, unknown> = { ...hostedIdentity };
      delete withoutMember[member];
      expect(
        OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse(
          withoutMember,
        ).success,
        member,
      ).toBe(false);
    }
  });

  it('binds the artifact SHA across hostedE2e and accessibility', () => {
    const otherRevision = 'c'.repeat(40);
    expect(otherRevision).not.toBe(completeEvidence.artifact.sourceRevision);

    expectRejectedAtPath(
      {
        ...hostedEvidence,
        hostedE2e: {
          ...hostedEvidence.hostedE2e,
          sourceRevision: otherRevision,
        },
      },
      ['artifact', 'sourceRevision'],
    );
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          sourceRevision: otherRevision,
        },
      },
      ['artifact', 'sourceRevision'],
    );
  });

  it('binds hostedE2e.migrationVersion to the artifact migration version', () => {
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        hostedE2e: {
          ...hostedEvidence.hostedE2e,
          migrationVersion: '20260903990000',
        },
      },
      ['hostedE2e', 'migrationVersion'],
    );
  });

  it('binds accessibility to the hostedE2e environment, deployment, and origin', () => {
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          environment: 'production',
        },
      },
      ['accessibility', 'environment'],
    );
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          deploymentId: 'deployment-99999999999',
        },
      },
      ['accessibility', 'deploymentId'],
    );
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          webOrigin: 'https://staging.example.invalid',
        },
      },
      ['accessibility', 'webOrigin'],
    );
  });

  it('enforces the locked nine roles and ten scenarios exactly once', () => {
    expect(CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES).toHaveLength(9);
    expect(CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS).toHaveLength(10);
    expect(hostedEvidence.hostedE2e.roles).toEqual([
      ...CONTENT_SCHEMA_REGISTRY_HOSTED_ROLES,
    ]);
    expect(hostedEvidence.hostedE2e.scenarios).toEqual([
      ...CONTENT_SCHEMA_REGISTRY_HOSTED_SCENARIOS,
    ]);

    // "Exactly once" is the locked set semantics: a missing or duplicated
    // member is rejected, while member order is not itself a contract term.
    const mutatedRoles = (
      mutate: (roles: readonly string[]) => readonly string[],
    ): unknown => ({
      ...hostedEvidence,
      hostedE2e: {
        ...hostedEvidence.hostedE2e,
        roles: mutate(hostedEvidence.hostedE2e.roles),
      },
    });
    const mutatedScenarios = (
      mutate: (scenarios: readonly string[]) => readonly string[],
    ): unknown => ({
      ...hostedEvidence,
      hostedE2e: {
        ...hostedEvidence.hostedE2e,
        scenarios: mutate(hostedEvidence.hostedE2e.scenarios),
      },
    });

    expectRejectedAtPath(
      mutatedRoles((roles) => roles.slice(1)),
      ['hostedE2e', 'roles'],
    );
    expectRejectedAtPath(
      mutatedRoles((roles) => [
        roles[0] ?? '',
        ...roles.slice(1, -1),
        roles[0] ?? '',
      ]),
      ['hostedE2e', 'roles'],
    );
    expectRejectedAtPath(
      mutatedScenarios((scenarios) => scenarios.slice(1)),
      ['hostedE2e', 'scenarios'],
    );
    expectRejectedAtPath(
      mutatedScenarios((scenarios) => [
        scenarios[0] ?? '',
        ...scenarios.slice(1, -1),
        scenarios[0] ?? '',
      ]),
      ['hostedE2e', 'scenarios'],
    );

    // Order is not a term of the locked contract.
    expect(
      OperationalHostedReleaseEvidenceShapeSchema.safeParse(
        mutatedRoles((roles) => [...roles.slice(1), roles[0] ?? '']),
      ).success,
    ).toBe(true);
    expect(
      OperationalHostedReleaseEvidenceShapeSchema.safeParse(
        mutatedScenarios((scenarios) => [
          ...scenarios.slice(1),
          scenarios[0] ?? '',
        ]),
      ).success,
    ).toBe(true);
  });

  it('enforces every locked manual accessibility check on both platform runs', () => {
    expect(CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS).toHaveLength(11);
    for (const [
      index,
      run,
    ] of hostedEvidence.accessibility.manualRuns.entries())
      expect(run.checks, `manual run ${index}`).toEqual([
        ...CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS,
      ]);

    const [droppedCheck, ...remainingChecks] =
      hostedEvidence.accessibility.manualRuns[0].checks;
    expect(droppedCheck).toBeDefined();
    const [voiceoverRun, nvdaRun] = hostedEvidence.accessibility.manualRuns;
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          manualRuns: [{ ...voiceoverRun, checks: remainingChecks }, nvdaRun],
        },
      },
      ['accessibility', 'manualRuns', 0, 'checks'],
    );
    expectRejectedAtPath(
      {
        ...hostedEvidence,
        accessibility: {
          ...hostedEvidence.accessibility,
          manualRuns: [
            {
              ...voiceoverRun,
              checks: [
                droppedCheck ?? '',
                ...remainingChecks.slice(0, -1),
                droppedCheck ?? '',
              ],
            },
            nvdaRun,
          ],
        },
      },
      ['accessibility', 'manualRuns', 0, 'checks'],
    );
  });

  it('requires verifiedAt to follow every retained hosted record', () => {
    const latestRetained = hostedEvidence.accessibility.manualRuns
      .map((run) => Date.parse(run.completedAt))
      .concat(Date.parse(hostedEvidence.hostedE2e.completedAt))
      .reduce((latest, value) => Math.max(latest, value), 0);
    expect(Number.isFinite(latestRetained)).toBe(true);

    expectRejectedAtPath(
      {
        ...hostedEvidence,
        verifiedAt: new Date(latestRetained - 1).toISOString(),
      },
      ['verifiedAt'],
    );
    expect(
      OperationalHostedReleaseEvidenceShapeSchema.safeParse({
        ...hostedEvidence,
        verifiedAt: new Date(latestRetained + 1).toISOString(),
      }).success,
    ).toBe(true);
  });

  it('[P2-S09-AC-266] leaves the production sidecar mandatory and unchanged', () => {
    const productionResult =
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse(
        hostedEvidence,
      );
    expect(productionResult.success).toBe(false);
    if (productionResult.success) return;
    expect(productionResult.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([['alerting'], ['slo']]),
    );

    expect(
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.parse(
        completeEvidence,
      ),
    ).toEqual(completeEvidence);
  });
});
