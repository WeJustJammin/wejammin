/**
 * DEC-104 hosted-scope retained-report consumer contract.
 *
 * DEC-104 (2026-09-25) authorizes routing AC265/AC266 acceptance through a
 * hosted-scope route that reuses the existing verifiers without the
 * production-bound `alerting`/`slo` members. This suite states the consumer
 * half of that route: the point where authenticated candidate provenance, the
 * protected hosted V3 verification context, the owner-pinned expected identity,
 * and the exact retained report bytes are bound at one verification boundary.
 *
 * The property under test is authority. Every accepted value must come from a
 * trust root:
 *
 *   * candidate provenance is the key-identity-branded
 *     `verifyAc265CandidateProvenance` result (`isVerifiedAc265CandidateProvenance`),
 *     never a structurally similar object;
 *   * the retained hosted report is bound by the protected V3 verification
 *     context, so its contents are authenticated rather than merely parsed;
 *   * the candidate ARCHIVE id and digest are brand-authenticated and remain
 *     distinct from the axe report digest inside that archive;
 *   * manual report bytes are digested against the pinned values;
 *   * the trusted cutoff is owner-pinned and cannot be in the future.
 *
 * A caller-supplied "verified" manifest is a claim about a past verification,
 * never an input that can authorize one, and is rejected on that basis.
 *
 * The suite was RED before the consumer existed. It adds no obligation and
 * relaxes none: the production sidecar remains mandatory and unchanged.
 *
 * COHERENCE. `phase-02-slice-09-hosted-scope-coherent-fixture.ts` composes one
 * candidate for both fixture families (a single uniform timestamp rebase plus
 * a real branded provenance mint), so the positive case below exercises one
 * internally consistent candidate rather than a merge. It is contract-fixture
 * data: no fixture, local run, or synthetic value here is hosted acceptance
 * evidence for AC265 or AC266.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { isVerifiedAc265CandidateProvenance } from '../../infra/workflows/ac265-candidate-provenance.ts';
import {
  verifyContentSchemaRegistryOperationalHostedReleaseEvidenceFile,
  type OperationalHostedRetainedEvidenceFileInput,
} from '../../infra/workflows/content-schema-registry-hosted-scope-consumer.ts';
import {
  ContentSchemaRegistryOperationalReleaseEvidenceSchema,
  OperationalReleaseEvidenceExpectedIdentitySchema,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import {
  OperationalHostedReleaseEvidenceExpectedIdentitySchema,
  OperationalHostedReleaseEvidenceShapeSchema,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-scope.ts';
import { createCoherentHostedScopeFixture } from './phase-02-slice-09-hosted-scope-coherent-fixture.ts';

const coherentFixtures: Array<{ close: () => void }> = [];

const coherentFixture = async () => {
  const fixture = await createCoherentHostedScopeFixture();
  coherentFixtures.push(fixture);
  return fixture;
};

afterAll(() => {
  for (const fixture of coherentFixtures.splice(0)) fixture.close();
});

// Keep the real consumer signature visible to the positive-path contract.
// Invalid-input cases intentionally cross that boundary as unknown.
const verifyHostedRetainedEvidence = (input: unknown): unknown =>
  verifyContentSchemaRegistryOperationalHostedReleaseEvidenceFile(
    input as OperationalHostedRetainedEvidenceFileInput,
  );

type JsonRecord = Record<string, unknown>;

const sha256Of = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const ECHOED_INPUT = /[0-9a-f]{40}|[0-9a-f]{64}|https:\/\/|sha256:/iu;

const expectSanitizedRejection = (caseLabel: string, input: unknown): void => {
  let thrown: unknown;
  try {
    verifyHostedRetainedEvidence(input);
  } catch (error: unknown) {
    thrown = error;
  }
  expect(thrown, `${caseLabel} must be rejected`).toBeInstanceOf(Error);
  if (!(thrown instanceof Error)) return;
  expect(thrown.message.length, `${caseLabel} non-empty`).toBeGreaterThan(0);
  expect(thrown.message.length, `${caseLabel} bounded`).toBeLessThanOrEqual(
    256,
  );
  expect(
    thrown.message,
    `${caseLabel} must not echo rejected input`,
  ).not.toMatch(ECHOED_INPUT);
};

/**
 * A structurally faithful lookalike of the branded provenance result: same
 * status, repository, and source revision, but never returned by
 * `verifyAc265CandidateProvenance`, so the brand must reject it.
 */
const lookalikeProvenance = (overrides: JsonRecord = {}): JsonRecord => ({
  status: 'candidate_provenance_verified',
  repository: 'WeJustJammin/wejammin',
  sourceRevision: 'a'.repeat(40),
  ci: {
    runId: '7001001',
    runAttempt: '2',
    workflowPath: '.github/workflows/ci.yml',
    artifactName: `workspace-build-${'a'.repeat(40)}`,
    artifactId: 3001,
    artifactDigest: 'b'.repeat(64),
  },
  staging: {
    runId: '7001002',
    runAttempt: '3',
    workflowPath: '.github/workflows/deploy-staging.yml',
    artifactName: 'staging-verified-candidate',
    artifactId: 3002,
    artifactDigest: `sha256:${'c'.repeat(64)}`,
    deploymentId: '7001003',
    deployedAt: '2026-09-03T10:08:00.000Z',
    environment: 'staging',
    webOrigin: 'https://staging.wejammin.invalid',
    apiOrigin: 'https://api.wejammin.invalid',
  },
  artifact: {
    artifactDigest: 'd'.repeat(64),
    buildId: 'ci-7001001',
    migrationVersion: '20260908000001',
  },
  migration: {
    projectRef: 'abcdef1234567890abcd',
    remoteHistorySha256: 'e'.repeat(64),
    verifiedAt: '2026-09-03T10:18:00.000Z',
  },
  provider: {
    evidenceSha256: 'f'.repeat(64),
    collectedAt: '2026-09-03T10:20:00.000Z',
    workers: [],
  },
  ...overrides,
});

type CoherentFixture = Awaited<ReturnType<typeof coherentFixture>>;

const inputWith = (
  fixture: CoherentFixture,
  overrides: JsonRecord = {},
): OperationalHostedRetainedEvidenceFileInput & JsonRecord => ({
  evidencePath: fixture.sidecarPath,
  expectedIdentity: fixture.expectedHostedIdentity,
  reportRoot: fixture.reportRoot,
  // The verification material minted for THIS candidate. The old retained
  // fixture's context binds a different deployment/migration and must not be
  // used here.
  hostedV3Verification: fixture.hostedV3Verification,
  candidateProvenance: fixture.provenance,
  authenticatedCandidateArchiveId: fixture.candidateArchive.artifactId,
  authenticatedCandidateArchiveDigest: fixture.candidateArchive.artifactDigest,
  authenticatedCandidateArchiveBytes: fixture.candidateArchive.archiveBytes,
  voiceoverReportBytes: fixture.voiceoverReportBytes,
  nvdaReportBytes: fixture.nvdaReportBytes,
  now: () => Date.parse('2026-09-03T12:05:00.000Z'),
  ...overrides,
});

describe('Slice 09 DEC-104 hosted-scope retained-report consumer', () => {
  it('PROVENANCE COHERENCE: mints one branded candidate that all signed windows agree on', async () => {
    const fixture = await coherentFixture();

    // The brand is the only accepted authority for candidate provenance.
    expect(isVerifiedAc265CandidateProvenance(fixture.provenance)).toBe(true);
    expect(isVerifiedAc265CandidateProvenance(lookalikeProvenance())).toBe(
      false,
    );

    // The hosted component schemas agree with the same candidate.
    expect(
      OperationalHostedReleaseEvidenceShapeSchema.safeParse(fixture.sidecar)
        .success,
    ).toBe(true);
    expect(
      OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse(
        fixture.expectedHostedIdentity,
      ).success,
    ).toBe(true);

    // The real V3 verifier accepted the coherent bytes: nine roles, ten
    // scenarios, all bound to the rebased deployment.
    expect(fixture.verifiedReport.roles).toHaveLength(9);
    expect(fixture.verifiedReport.scenarios).toHaveLength(10);
    expect(fixture.verifiedReport.deploymentId).toBe(
      fixture.provenance.staging.deploymentId,
    );
    expect(fixture.verifiedReport.sourceRevision).toBe(
      fixture.provenance.sourceRevision,
    );
  });

  it('rejects a pasted verified manifest offered as authority', async () => {
    const fixture = await coherentFixture();
    const forgedManifest = {
      criterion: 'P2-S09-AC-266',
      status: 'verified',
      scope: 'staging',
      environment: 'staging',
      sourceRevision: fixture.provenance.sourceRevision,
      deploymentId: fixture.provenance.staging.deploymentId,
      reportSha256: 'a'.repeat(64),
      roles: [],
      scenarios: [],
    };
    const manifestPath = join(fixture.reportRoot, '..', 'pasted-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(forgedManifest));

    expectSanitizedRejection(
      'pasted verified manifest as retained evidence',
      inputWith(fixture, { evidencePath: manifestPath }),
    );
  });

  it('CONSUMER POSITIVE: verifies the coherent candidate and returns a minimized manifest', async () => {
    const fixture = await coherentFixture();

    // This is the case the fixture exists for: one call over the composed
    // trust chain (branded provenance + protected V3 context + pinned identity
    // + exact retained bytes) must succeed. An always-throwing consumer, or one
    // wired to the wrong candidate, fails here.
    const result = verifyHostedRetainedEvidence(
      inputWith(fixture),
    ) as JsonRecord;
    expect(result).toBeTruthy();

    // Everything the manifest claims is bound to THIS candidate.
    expect(result).toMatchObject({
      boundary: 'retained_report_byte_verification',
      status: 'report_bytes_verified',
      acceptance: 'not_claimed',
      scope: 'staging',
      environment: 'staging',
      sourceRevision: fixture.provenance.sourceRevision,
      deploymentId: fixture.provenance.staging.deploymentId,
      buildId: fixture.contract.identity.buildId,
      migrationVersion: fixture.contract.identity.migrationVersion,
      webOrigin: fixture.contract.identity.webOrigin,
      apiOrigin: fixture.contract.identity.apiOrigin,
      supabaseOrigin: fixture.contract.identity.supabaseOrigin,
    });

    // The axe half is bound to the candidate's own axe bytes, which differ
    // from the archive digest.
    expect(result['axeReportSha256']).toBe(fixture.axeReportDigest);
    expect(result['axeReportSha256']).not.toBe(
      fixture.candidateArchive.artifactDigest,
    );

    // The manual half is bound to the exact secret-supplied bytes.
    expect(result).toMatchObject({
      voiceoverReportSha256: sha256Of(fixture.voiceoverReportBytes),
      nvdaReportSha256: sha256Of(fixture.nvdaReportBytes),
    });

    // Locked coverage is carried through, not summarized away.
    expect(result['roles']).toHaveLength(9);
    expect(result['scenarios']).toHaveLength(10);

    // The manifest is minimized: verdict and bindings only, never raw report
    // bodies, session material, or authority internals.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /runnerContractBytes|verificationContext|executionEvidence|sessionRef|"report":/u,
    );
  });

  it('rejects a lookalike provenance object where a branded result is required', async () => {
    const fixture = await coherentFixture();
    const lookalike = lookalikeProvenance();
    expect(isVerifiedAc265CandidateProvenance(lookalike)).toBe(false);

    expectSanitizedRejection('unbranded candidate provenance', {
      ...inputWith(fixture),
      candidateProvenance: lookalike,
    });
  });

  it('keeps the candidate archive identity distinct from the axe report digest', async () => {
    const fixture = await coherentFixture();

    expect(fixture.candidateArchive.artifactDigest).not.toBe(
      fixture.axeReportDigest,
    );
    // Brand-authenticated archive identity: the branded result carries it.
    expect(fixture.candidateArchive.artifactId).toBe(
      fixture.provenance.staging.artifactId,
    );
    expect(fixture.candidateArchive.artifactDigest).toBe(
      fixture.provenance.staging.artifactDigest,
    );
    // API-reported archive length is carried by the brand, but is not a
    // recomputation of the downloaded ZIP bytes.
    expect(fixture.candidateArchive.archiveBytes).toBeGreaterThan(0);
    expect(fixture.candidateArchive.archiveBytes).toBe(
      fixture.provenance.staging.artifactBytes,
    );

    expectSanitizedRejection('axe report digest used as archive digest', {
      ...inputWith(fixture),
      authenticatedCandidateArchiveDigest: fixture.axeReportDigest,
    });
    expectSanitizedRejection('archive digest drift', {
      ...inputWith(fixture),
      authenticatedCandidateArchiveDigest: `sha256:${'9'.repeat(64)}`,
    });
    expectSanitizedRejection('archive byte length drift', {
      ...inputWith(fixture),
      authenticatedCandidateArchiveBytes: 1,
    });
    expectSanitizedRejection('missing archive identity', {
      ...inputWith(fixture),
      authenticatedCandidateArchiveId: undefined,
    });
  });

  it('requires the protected hosted V3 verification context', async () => {
    const fixture = await coherentFixture();

    for (const missing of [
      undefined,
      null,
      {},
      { runnerContractBytes: 'not-bytes' },
    ])
      expectSanitizedRejection('missing or malformed V3 context', {
        ...inputWith(fixture),
        hostedV3Verification: missing,
      });
  });

  it('rejects manual report bytes that do not match the pinned digests', async () => {
    const fixture = await coherentFixture();

    expectSanitizedRejection('VoiceOver bytes offered as NVDA', {
      ...inputWith(fixture),
      nvdaReportBytes: fixture.voiceoverReportBytes,
    });
    expectSanitizedRejection('truncated NVDA bytes', {
      ...inputWith(fixture),
      nvdaReportBytes: fixture.nvdaReportBytes.subarray(
        0,
        fixture.nvdaReportBytes.byteLength - 1,
      ),
    });
    expectSanitizedRejection('missing VoiceOver bytes', {
      ...inputWith(fixture),
      voiceoverReportBytes: undefined,
    });
  });

  it('rejects a sidecar whose retained records name another deployment', async () => {
    const fixture = await coherentFixture();
    const hostedE2e = fixture.sidecar['hostedE2e'] as JsonRecord;
    const accessibility = fixture.sidecar['accessibility'] as JsonRecord;
    const foreignPath = join(fixture.reportRoot, '..', 'foreign-sidecar.json');
    writeFileSync(
      foreignPath,
      JSON.stringify({
        ...fixture.sidecar,
        hostedE2e: { ...hostedE2e, deploymentId: 'deployment-99999999999' },
        accessibility: {
          ...accessibility,
          deploymentId: 'deployment-99999999999',
        },
      }),
    );

    expectSanitizedRejection(
      'sidecar naming another deployment',
      inputWith(fixture, { evidencePath: foreignPath }),
    );
  });

  it('rejects a retained report outside the trusted window', async () => {
    const fixture = await coherentFixture();

    expectSanitizedRejection('future trusted cutoff', {
      ...inputWith(fixture),
      expectedIdentity: {
        ...fixture.expectedHostedIdentity,
        trustedCutoffAt: '2026-09-03T12:40:00.000Z',
      },
    });
    expectSanitizedRejection('invalid trusted clock', {
      ...inputWith(fixture),
      now: () => Number.NaN,
    });
  });

  it('[P2-S09-AC-266] leaves the production sidecar mandatory and unchanged', async () => {
    const fixture = await coherentFixture();

    const projected =
      ContentSchemaRegistryOperationalReleaseEvidenceSchema.safeParse(
        fixture.sidecar,
      );
    expect(projected.success).toBe(false);
    if (projected.success) return;
    expect(projected.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([['alerting'], ['slo']]),
    );

    const productionIdentity =
      OperationalReleaseEvidenceExpectedIdentitySchema.safeParse(
        fixture.expectedHostedIdentity,
      );
    expect(productionIdentity.success).toBe(false);
    if (productionIdentity.success) return;
    expect(productionIdentity.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        ['productionDeploymentId'],
        ['productionDeployedAt'],
      ]),
    );
  });
});
