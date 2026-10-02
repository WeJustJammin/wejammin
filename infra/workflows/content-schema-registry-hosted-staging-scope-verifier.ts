import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

import { readAc265HostedArtifactArchive } from './ac265-hosted-artifact-archive.ts';
import {
  ContentSchemaRegistryHostedRunnerContractSchema,
  type ContentSchemaRegistryHostedRunnerContract,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-input.ts';
import type { ContentSchemaRegistryHostedE2eReportV3 } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-report.ts';
import { createAc265HostedArtifactSourceAuthority } from './ac265-hosted-artifact-source-manifest.ts';
import { readAc265HostedVerificationSources } from './ac265-hosted-verification-archive-sources.ts';
import {
  parseAc265HostedVerificationContextBundle,
  type Ac265HostedVerificationContextBundle,
} from './ac265-hosted-verification-context-bundle.ts';
import {
  AC265_HOSTED_SCOPE_FAILURE,
  failAc265HostedVerification,
} from './ac265-hosted-verification-bundle-errors.ts';
import { validateContentSchemaRegistryHostedE2eReportV3Bytes } from './content-schema-registry-hosted-e2e-report-verifier.ts';

export { AC265_HOSTED_SCOPE_FAILURE };

export interface Ac265HostedStagingScopeInput {
  readonly bundleBytes: unknown;
  /**
   * Path to the exact report archive downloaded from the independently
   * verified run. The archive digest is compared against the GitHub-reported
   * artifact digest, and the report body is read only through the verified
   * archive member.
   */
  readonly reportArchivePath: unknown;
  /**
   * Digest reported by the GitHub Actions artifact API for the exact report
   * archive. It authenticates the archive, never the report body.
   */
  readonly authenticatedReportArchiveSha256: unknown;
  /** Byte length reported by the GitHub Actions artifact API. */
  readonly authenticatedReportArchiveBytes: unknown;
  /** Run identity independently authenticated by the GitHub Actions API. */
  readonly authenticatedStagingRunId: unknown;
  readonly authenticatedStagingRunAttempt: unknown;
  /** Source revision reported for the independently verified run. */
  readonly authenticatedSourceRevision: unknown;
  /** Staging deployment identity reported for the independently verified run. */
  readonly authenticatedDeploymentId: unknown;
  /**
   * Trusted wall clock. A cutoff that has not yet occurred cannot bound a
   * completed staging run, so a future cutoff fails closed. Defaults to the
   * current time.
   */
  readonly now?: () => number;
}

export interface Ac265HostedStagingScopeManifest {
  readonly criterion: 'P2-S09-AC-265';
  readonly status: 'verified';
  readonly scope: 'staging';
  readonly environment: 'staging';
  readonly runId: string;
  readonly sourceRevision: string;
  readonly deploymentId: string;
  readonly buildId: string;
  readonly migrationVersion: string;
  readonly artifactSha256: string;
  readonly webOrigin: string;
  readonly apiOrigin: string;
  readonly supabaseOrigin: string;
  readonly reportSha256: string;
  readonly reportArchiveSha256: string;
  readonly runnerContractSha256: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly trustedCutoffAt: string;
  readonly roles: readonly string[];
  readonly scenarios: readonly string[];
}

const sha256Bytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const requireAbsolutePath = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !isAbsolute(value) ||
    resolve(value) !== value ||
    value.includes('\0')
  )
    return failAc265HostedVerification();
  return value;
};

/**
 * Read the report body exclusively through the downloaded archive whose
 * digest and byte length were reported by the GitHub Actions artifact API for
 * the verified run. The report body digest is then compared to the digest
 * pinned by the protected producer, so archive identity and report-body
 * identity stay separate comparisons.
 */
const readReportBodyFromAuthenticatedArchive = (input: {
  readonly reportArchivePath: string;
  readonly authenticatedReportArchiveSha256: string;
  readonly authenticatedReportArchiveBytes: number;
  readonly authenticatedReportBodySha256: string;
  readonly reportArchiveMember: string;
}): Uint8Array => {
  const archive = readAc265HostedArtifactArchive({
    archivePath: input.reportArchivePath,
    expectedArchiveBytes: input.authenticatedReportArchiveBytes,
    expectedArchiveSha256: input.authenticatedReportArchiveSha256,
    allowedMembers: [input.reportArchiveMember],
    requiredMembers: [input.reportArchiveMember],
  });
  const member = archive.members.find(
    (candidate) => candidate.name === input.reportArchiveMember,
  );
  if (member === undefined) return failAc265HostedVerification();
  const bytes = Buffer.from(member.bytes);
  if (sha256Bytes(bytes) !== input.authenticatedReportBodySha256)
    return failAc265HostedVerification();
  return bytes;
};

const requireBytes = (value: unknown): Uint8Array => {
  if (!(value instanceof Uint8Array) || value.byteLength === 0)
    return failAc265HostedVerification();
  return value;
};

const requireDigest = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
    return failAc265HostedVerification();
  return value;
};

const requireRevision = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/u.test(value))
    return failAc265HostedVerification();
  return value;
};

const parseBundle = (value: unknown): Ac265HostedVerificationContextBundle => {
  try {
    return parseAc265HostedVerificationContextBundle(requireBytes(value));
  } catch {
    return failAc265HostedVerification();
  }
};

const parseContract = (
  bundle: Ac265HostedVerificationContextBundle,
): ContentSchemaRegistryHostedRunnerContract => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(bundle.runnerContractBytes).toString('utf8'),
    );
  } catch {
    return failAc265HostedVerification();
  }
  const result =
    ContentSchemaRegistryHostedRunnerContractSchema.safeParse(parsed);
  if (!result.success) return failAc265HostedVerification();
  if (result.data.identity.environment !== 'staging')
    return failAc265HostedVerification();
  return result.data;
};

/**
 * Assemble the existing branded V3 verification context. The bundle transports
 * owner-controlled trust material only; identity, mappings, attestations, the
 * signed source manifest, and the cutoff are authenticated by the same parsers
 * the aggregated release route uses, and the artifact sources are materialized
 * from bounded archive reads matched to the signed manifest.
 */
export const buildAc265HostedVerificationContext = (
  value: unknown,
): Record<string, unknown> => {
  const bundle = parseBundle(value);
  const contract = parseContract(bundle);
  const manifestBytes = Buffer.from(bundle.sourceManifestBase64, 'base64');
  const authority = createAc265HostedArtifactSourceAuthority({
    manifestBytes,
    expected: bundle.sourceManifestExpected,
    trustedAuthorityKeys: bundle.sourceManifestTrustedKeys,
    artifactTrustedKeys: bundle.artifactTrustedKeys,
    trustedCutoffAt: bundle.trustedCutoffAt,
  });
  const resolver = authority.createResolver(
    readAc265HostedVerificationSources({
      archives: bundle.archives,
      manifestBytes,
    }),
  );
  return {
    expectedIdentity: contract.identity,
    expectedRunId: contract.runId,
    expectedRunnerContractSha256: sha256Bytes(bundle.runnerContractBytes),
    expectedRoleResourceBindings: contract.roleResourceBindings,
    expectedScenarioRoleBindings: contract.scenarioRoleBindings,
    approvedRunnerMappingsBytes: Buffer.from(
      bundle.approvedRunnerMappingsBase64,
      'base64',
    ),
    approvedRunnerMappingAttestationBytes: Buffer.from(
      bundle.approvedRunnerMappingAttestationBase64,
      'base64',
    ),
    approvedRunnerMappingTrustedKeys: bundle.approvedRunnerMappingTrustedKeys,
    approvedOutageTargetBytes: Buffer.from(
      bundle.approvedOutageTargetBase64,
      'base64',
    ),
    approvedOutageTargetAttestationBytes: Buffer.from(
      bundle.approvedOutageTargetAttestationBase64,
      'base64',
    ),
    approvedOutageTargetTrustedKeys: bundle.approvedOutageTargetTrustedKeys,
    maxRunDurationMs: bundle.maxRunDurationMs,
    trustedCutoffAt: bundle.trustedCutoffAt,
    resolver,
  };
};

export const verifyAc265HostedStagingEvidence = (
  input: Ac265HostedStagingScopeInput,
): Ac265HostedStagingScopeManifest => {
  const bundle = parseBundle(input.bundleBytes);
  const reportArchivePath = requireAbsolutePath(input.reportArchivePath);
  const authenticatedReportArchiveSha256 = requireDigest(
    input.authenticatedReportArchiveSha256,
  );
  const authenticatedReportArchiveBytes = input.authenticatedReportArchiveBytes;
  if (
    typeof authenticatedReportArchiveBytes !== 'number' ||
    !Number.isSafeInteger(authenticatedReportArchiveBytes) ||
    authenticatedReportArchiveBytes <= 0
  )
    return failAc265HostedVerification();
  // The report-body digest is owner-pinned inside the protected bundle; it is
  // never accepted from the caller or derived from the bytes being checked.
  const authenticatedReportBodySha256 = bundle.reportBodySha256;
  const authenticatedSourceRevision = requireRevision(
    input.authenticatedSourceRevision,
  );
  const authenticatedStagingRunId = input.authenticatedStagingRunId;
  const authenticatedStagingRunAttempt = input.authenticatedStagingRunAttempt;
  if (
    typeof authenticatedStagingRunId !== 'string' ||
    !/^[1-9][0-9]{0,18}$/u.test(authenticatedStagingRunId) ||
    typeof authenticatedStagingRunAttempt !== 'number' ||
    !Number.isSafeInteger(authenticatedStagingRunAttempt) ||
    authenticatedStagingRunAttempt < 1 ||
    authenticatedStagingRunAttempt > 1_000
  )
    return failAc265HostedVerification();
  const authenticatedDeploymentId = input.authenticatedDeploymentId;
  if (
    typeof authenticatedDeploymentId !== 'string' ||
    authenticatedDeploymentId.length === 0
  )
    return failAc265HostedVerification();
  const trustedNow = (input.now ?? Date.now)();
  const trustedCutoffMs = Date.parse(bundle.trustedCutoffAt);
  if (
    !Number.isFinite(trustedNow) ||
    !Number.isFinite(trustedCutoffMs) ||
    trustedCutoffMs > trustedNow
  )
    return failAc265HostedVerification();
  let report: ContentSchemaRegistryHostedE2eReportV3;
  try {
    // The archive digest authenticates the downloaded archive; the report body
    // digest is compared only after the verified member is read.
    report = validateContentSchemaRegistryHostedE2eReportV3Bytes(
      readReportBodyFromAuthenticatedArchive({
        reportArchivePath,
        authenticatedReportArchiveSha256,
        authenticatedReportArchiveBytes,
        authenticatedReportBodySha256,
        reportArchiveMember: bundle.reportArchiveMember,
      }),
      authenticatedReportBodySha256,
      bundle.runnerContractBytes,
      buildAc265HostedVerificationContext(input.bundleBytes),
    );
  } catch {
    return failAc265HostedVerification();
  }
  const contract = parseContract(bundle);
  if (
    report.environment !== 'staging' ||
    contract.identity.stagingRunId !== authenticatedStagingRunId ||
    contract.identity.stagingRunAttempt !== authenticatedStagingRunAttempt ||
    report.sourceRevision !== authenticatedSourceRevision ||
    report.sourceRevision !== contract.identity.sourceRevision ||
    report.deploymentId !== authenticatedDeploymentId ||
    report.deploymentId !== contract.identity.deploymentId ||
    report.runId !== contract.runId
  )
    return failAc265HostedVerification();
  return Object.freeze({
    criterion: 'P2-S09-AC-265' as const,
    status: 'verified' as const,
    scope: 'staging' as const,
    environment: report.environment,
    runId: report.runId,
    sourceRevision: report.sourceRevision,
    deploymentId: report.deploymentId,
    buildId: report.buildId,
    migrationVersion: report.migrationVersion,
    artifactSha256: report.artifactSha256,
    webOrigin: report.webOrigin,
    apiOrigin: report.apiOrigin,
    supabaseOrigin: report.supabaseOrigin,
    reportSha256: authenticatedReportBodySha256,
    reportArchiveSha256: authenticatedReportArchiveSha256,
    runnerContractSha256: report.runnerContractSha256,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    trustedCutoffAt: bundle.trustedCutoffAt,
    roles: report.roles.map((result) => result.role),
    scenarios: report.scenarios.map((result) => result.scenario),
  });
};
