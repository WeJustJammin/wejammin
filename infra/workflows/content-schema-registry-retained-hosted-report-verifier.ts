import type {
  ContentSchemaRegistryOperationalReleaseEvidence,
  OperationalReleaseEvidenceExpectedIdentity,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import type { ContentSchemaRegistryHostedE2eReportV3 } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-report-v3.ts';
import { isVerifiedAc265CandidateProvenance } from './ac265-candidate-provenance.ts';
import type { Ac265VerifiedCandidateProvenance } from './ac265-candidate-provenance-common.ts';
import { validateContentSchemaRegistryHostedE2eReportV3Bytes } from './content-schema-registry-hosted-e2e-report-verifier.ts';
import {
  parseHostedV3Verification,
  type RetainedHostedE2eVerificationInput,
} from './content-schema-registry-retained-hosted-context.ts';

export type { RetainedHostedE2eVerificationInput } from './content-schema-registry-retained-hosted-context.ts';

type HostedReleaseEvidence = Pick<
  ContentSchemaRegistryOperationalReleaseEvidence,
  'artifact' | 'hostedE2e'
>;

// Production deployment fields belong to the production sidecar, not to the
// shared retained hosted-report byte verifier.
type HostedExpectedIdentity = Pick<
  OperationalReleaseEvidenceExpectedIdentity,
  | 'sourceRevision'
  | 'artifactDigest'
  | 'buildId'
  | 'migrationVersion'
  | 'hostedEnvironment'
  | 'hostedDeploymentId'
  | 'hostedDeployedAt'
  | 'webOrigin'
  | 'apiOrigin'
  | 'supabaseOrigin'
  | 'trustedCutoffAt'
>;

const sameMembers = (
  actual: readonly string[],
  expected: readonly string[],
): boolean => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return (
    actualSet.size === actual.length &&
    expectedSet.size === expected.length &&
    actualSet.size === expectedSet.size &&
    [...actualSet].every((member) => expectedSet.has(member))
  );
};

const assertHostedReportMatchesReleaseIdentity = (
  report: ContentSchemaRegistryHostedE2eReportV3,
  evidence: HostedReleaseEvidence,
  expected: HostedExpectedIdentity,
  expectedReportArtifactSha256: string,
): void => {
  const hosted = evidence.hostedE2e;
  const hostedDeployedAt = Date.parse(expected.hostedDeployedAt);
  const trustedCutoffAt = Date.parse(expected.trustedCutoffAt);
  if (
    report.sourceRevision !== evidence.artifact.sourceRevision ||
    report.sourceRevision !== hosted.sourceRevision ||
    report.sourceRevision !== expected.sourceRevision
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release source identity.',
    );
  if (
    evidence.artifact.artifactDigest !== expected.artifactDigest ||
    report.artifactSha256 !== expectedReportArtifactSha256
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release artifact identity.',
    );
  if (
    report.buildId !== evidence.artifact.buildId ||
    report.buildId !== expected.buildId
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release build identity.',
    );
  if (
    report.migrationVersion !== evidence.artifact.migrationVersion ||
    report.migrationVersion !== hosted.migrationVersion ||
    report.migrationVersion !== expected.migrationVersion
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release migration identity.',
    );
  if (
    report.environment !== hosted.environment ||
    report.environment !== expected.hostedEnvironment ||
    report.deploymentId !== hosted.deploymentId ||
    report.deploymentId !== expected.hostedDeploymentId ||
    Date.parse(report.deployedAt) !== hostedDeployedAt ||
    Date.parse(report.startedAt) < hostedDeployedAt
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release deployment identity.',
    );
  if (
    report.webOrigin !== hosted.webOrigin ||
    report.webOrigin !== expected.webOrigin ||
    report.apiOrigin !== hosted.apiOrigin ||
    report.apiOrigin !== expected.apiOrigin ||
    report.supabaseOrigin !== hosted.supabaseOrigin ||
    report.supabaseOrigin !== expected.supabaseOrigin
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release origins.',
    );
  if (
    report.idpProvider !== hosted.idpProvider ||
    report.completedAt !== hosted.completedAt ||
    !Number.isFinite(trustedCutoffAt) ||
    Date.parse(report.completedAt) > trustedCutoffAt
  )
    throw new Error(
      'Retained hosted E2E V3 report does not match the release completion time.',
    );
  if (
    !sameMembers(
      report.roles.map(({ role }) => role),
      hosted.roles,
    )
  )
    throw new Error(
      'Retained hosted E2E V3 report roles do not match the release evidence.',
    );
  if (
    !sameMembers(
      report.scenarios.map(({ scenario }) => scenario),
      hosted.scenarios,
    )
  )
    throw new Error(
      'Retained hosted E2E V3 report scenarios do not match the release evidence.',
    );
};

const validateAndBindRetainedHostedE2eReportV3WithArtifact = (
  reportBytes: Uint8Array,
  expectedDigest: string,
  verificationInput: RetainedHostedE2eVerificationInput,
  evidence: HostedReleaseEvidence,
  expectedIdentity: HostedExpectedIdentity,
  expectedReportArtifactSha256: string,
): void => {
  const trusted = parseHostedV3Verification(verificationInput);
  const report = validateContentSchemaRegistryHostedE2eReportV3Bytes(
    reportBytes,
    expectedDigest,
    trusted.runnerContractBytes,
    trusted.verificationContext,
  );
  assertHostedReportMatchesReleaseIdentity(
    report,
    evidence,
    expectedIdentity,
    expectedReportArtifactSha256,
  );
};

/** Existing production sidecar semantics: one artifact digest in both records. */
export const validateAndBindRetainedHostedE2eReportV3 = (
  reportBytes: Uint8Array,
  expectedDigest: string,
  verificationInput: RetainedHostedE2eVerificationInput,
  evidence: HostedReleaseEvidence,
  expectedIdentity: HostedExpectedIdentity,
): void =>
  validateAndBindRetainedHostedE2eReportV3WithArtifact(
    reportBytes,
    expectedDigest,
    verificationInput,
    evidence,
    expectedIdentity,
    expectedIdentity.artifactDigest,
  );

/**
 * DEC-104 hosted-only semantics: the protected runner report commits to the
 * CI workspace archive, while the release sidecar names the deployment
 * manifest. The CI digest is accepted only from a live branded provenance
 * result, never a caller-supplied digest string.
 */
export const validateAndBindRetainedHostedE2eReportV3ToVerifiedCandidate = (
  reportBytes: Uint8Array,
  expectedDigest: string,
  verificationInput: RetainedHostedE2eVerificationInput,
  evidence: HostedReleaseEvidence,
  expectedIdentity: HostedExpectedIdentity,
  candidate: Ac265VerifiedCandidateProvenance,
): void => {
  if (
    !isVerifiedAc265CandidateProvenance(candidate) ||
    candidate.sourceRevision !== expectedIdentity.sourceRevision ||
    candidate.artifact.artifactDigest !== expectedIdentity.artifactDigest ||
    candidate.artifact.buildId !== expectedIdentity.buildId ||
    candidate.artifact.migrationVersion !== expectedIdentity.migrationVersion ||
    !/^sha256:[a-f0-9]{64}$/u.test(candidate.ci.artifactDigest)
  )
    throw new Error('Verified hosted candidate identity is invalid.');
  validateAndBindRetainedHostedE2eReportV3WithArtifact(
    reportBytes,
    expectedDigest,
    verificationInput,
    evidence,
    expectedIdentity,
    candidate.ci.artifactDigest.slice('sha256:'.length),
  );
};
