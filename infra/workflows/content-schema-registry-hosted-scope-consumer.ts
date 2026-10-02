import { createHash } from 'node:crypto';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import {
  OperationalHostedReleaseEvidenceExpectedIdentitySchema,
  type OperationalHostedReleaseEvidenceExpectedIdentity,
  type OperationalHostedReleaseEvidenceShape,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-scope.ts';
import { isVerifiedAc265CandidateProvenance } from './ac265-candidate-provenance.ts';
import type { Ac265VerifiedCandidateProvenance } from './ac265-candidate-provenance-common.ts';
import {
  CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
  parseContentSchemaRegistryAutomatedAxeDigestSidecar,
  validateContentSchemaRegistryAutomatedAxeReportBytes,
} from './content-schema-registry-axe-report-verifier.ts';
import { validateContentSchemaRegistryOperationalHostedReleaseEvidence } from './content-schema-registry-hosted-scope-identity-verifier.ts';
import { validateContentSchemaRegistryManualAccessibilityReportBytes } from './content-schema-registry-manual-accessibility-report-verifier.ts';
import { validateAndBindRetainedHostedE2eReportV3ToVerifiedCandidate } from './content-schema-registry-retained-hosted-report-verifier.ts';
import type { RetainedHostedE2eVerificationInput } from './content-schema-registry-retained-hosted-context.ts';
import {
  readStableReport,
  verifyReportTree,
} from './content-schema-registry-retained-report-verifier.ts';
import { parseStrictJson } from './parse-strict-json.ts';

const MAX_RETAINED_REPORT_BYTES = 10 * 1024 * 1024;
const FAILURE = 'Hosted release evidence verification failed.';
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

type ReportReference = Readonly<{ path: string; sha256: string }>;

/**
 * A byte-verification boundary, not a source of hosted acceptance on its own.
 * The caller must obtain candidateProvenance from the GitHub-backed verifier,
 * download the candidate by that artifact ID with digest mismatch fatal, and
 * supply owner-pinned identity and protected hosted V3 verification context.
 * The sidecar is self-describing, not independently signed: every identity and
 * report reference is rebound to those authorities and the exact report bytes.
 */
export interface OperationalHostedRetainedEvidenceFileInput {
  readonly evidencePath: string;
  readonly expectedIdentity: OperationalHostedReleaseEvidenceExpectedIdentity;
  readonly reportRoot: string;
  readonly candidateProvenance: Ac265VerifiedCandidateProvenance;
  readonly hostedV3Verification: RetainedHostedE2eVerificationInput;
  readonly authenticatedCandidateArchiveId: number;
  readonly authenticatedCandidateArchiveDigest: string;
  readonly authenticatedCandidateArchiveBytes: number;
  readonly voiceoverReportBytes: Uint8Array;
  readonly nvdaReportBytes: Uint8Array;
  readonly now?: () => number;
}

export interface OperationalHostedRetainedEvidenceManifest {
  readonly criterion: 'P2-S09-AC-266';
  readonly boundary: 'retained_report_byte_verification';
  readonly status: 'report_bytes_verified';
  readonly acceptance: 'not_claimed';
  readonly scope: 'staging';
  readonly environment: 'staging';
  readonly sourceRevision: string;
  readonly deploymentId: string;
  readonly buildId: string;
  readonly migrationVersion: string;
  readonly webOrigin: string;
  readonly apiOrigin: string;
  readonly supabaseOrigin: string;
  readonly artifactDigest: string;
  readonly candidateArchiveId: number;
  readonly candidateArchiveDigest: string;
  readonly candidateArchiveBytes: number;
  readonly hostedReportSha256: string;
  readonly axeReportSha256: string;
  readonly voiceoverReportSha256: string;
  readonly nvdaReportSha256: string;
  readonly roles: readonly string[];
  readonly scenarios: readonly string[];
  readonly trustedCutoffAt: string;
  readonly verifiedAt: string;
}

const fail = (): never => {
  throw new Error(FAILURE);
};

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const requireCanonicalFile = (path: unknown, label: string): Buffer => {
  if (typeof path !== 'string' || !isAbsolute(path) || resolve(path) !== path)
    return fail();
  const canonical = realpathSync(path);
  if (canonical !== path) return fail();
  return readStableReport(path, canonical, label).bytes;
};

const requireCanonicalRoot = (path: unknown): string => {
  if (typeof path !== 'string' || !isAbsolute(path) || resolve(path) !== path)
    return fail();
  const canonical = realpathSync(path);
  if (canonical !== path || !statSync(canonical).isDirectory()) return fail();
  return canonical;
};

const readFromRoot = (
  root: string,
  path: string,
  label: string,
): Readonly<{ bytes: Buffer; fileIdentity: string; canonical: string }> => {
  const candidate = resolve(root, path);
  const rootRelative = relative(root, candidate);
  if (
    rootRelative === '' ||
    isAbsolute(rootRelative) ||
    rootRelative === '..' ||
    rootRelative.startsWith(`..${sep}`)
  )
    return fail();
  const canonical = realpathSync(candidate);
  if (canonical !== candidate) return fail();
  const { bytes, fileIdentity } = readStableReport(candidate, canonical, label);
  if (bytes.byteLength > MAX_RETAINED_REPORT_BYTES) return fail();
  return { bytes, fileIdentity, canonical };
};

const parseEvidenceFile = (path: unknown): unknown => {
  const bytes = requireCanonicalFile(path, 'hosted release evidence');
  const utf8 = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  return parseStrictJson(utf8);
};

const bindCandidate = (
  candidate: unknown,
  expected: OperationalHostedReleaseEvidenceExpectedIdentity,
  evidence: OperationalHostedReleaseEvidenceShape,
  input: OperationalHostedRetainedEvidenceFileInput,
): Ac265VerifiedCandidateProvenance => {
  if (!isVerifiedAc265CandidateProvenance(candidate)) return fail();
  const staging = candidate.staging;
  if (
    candidate.sourceRevision !== expected.sourceRevision ||
    candidate.artifact.artifactDigest !== expected.artifactDigest ||
    candidate.artifact.buildId !== expected.buildId ||
    candidate.artifact.migrationVersion !== expected.migrationVersion ||
    staging.environment !== 'staging' ||
    staging.deploymentId !== expected.hostedDeploymentId ||
    staging.deployedAt !== expected.hostedDeployedAt ||
    staging.webOrigin !== expected.webOrigin ||
    staging.apiOrigin !== expected.apiOrigin ||
    staging.artifactId !== input.authenticatedCandidateArchiveId ||
    staging.artifactDigest !== input.authenticatedCandidateArchiveDigest ||
    staging.artifactBytes !== input.authenticatedCandidateArchiveBytes ||
    !DIGEST_PATTERN.test(staging.artifactDigest) ||
    candidate.artifact.axeReportSha256 !==
      evidence.accessibility.automatedReport.sha256
  )
    return fail();
  return candidate;
};

const reportReferences = (
  evidence: OperationalHostedReleaseEvidenceShape,
): readonly (readonly [string, ReportReference])[] => [
  ['hosted E2E', evidence.hostedE2e.report],
  ['automated accessibility', evidence.accessibility.automatedReport],
  ['VoiceOver accessibility', evidence.accessibility.manualRuns[0].report],
  ['NVDA accessibility', evidence.accessibility.manualRuns[1].report],
];

/**
 * Re-verify the exact hosted, axe, and manual report bytes against one branded
 * staging candidate. No production alert/SLO evidence is synthesized here.
 */
export const verifyContentSchemaRegistryOperationalHostedReleaseEvidenceFile = (
  input: OperationalHostedRetainedEvidenceFileInput,
): OperationalHostedRetainedEvidenceManifest => {
  try {
    if (typeof input !== 'object' || input === null) return fail();
    const expected =
      OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse(
        input.expectedIdentity,
      );
    if (!expected.success) return fail();
    const evidence =
      validateContentSchemaRegistryOperationalHostedReleaseEvidence(
        parseEvidenceFile(input.evidencePath),
        expected.data,
        input.now,
      );
    const candidate = bindCandidate(
      input.candidateProvenance,
      expected.data,
      evidence,
      input,
    );

    const root = requireCanonicalRoot(input.reportRoot);
    const references = reportReferences(evidence);
    const optionalAxeDigestPath = resolve(
      root,
      CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
    );
    const allowedPaths = new Set(references.map(([, ref]) => ref.path));
    if (existsSync(optionalAxeDigestPath))
      allowedPaths.add(CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH);
    if (
      allowedPaths.size !==
      references.length + (existsSync(optionalAxeDigestPath) ? 1 : 0)
    )
      return fail();
    verifyReportTree(root, allowedPaths);

    const reportBytes = new Map<string, Buffer>();
    const seenFiles = new Set<string>();
    const seenIdentities = new Set<string>();
    for (const [label, reference] of references) {
      const retained = readFromRoot(root, reference.path, label);
      if (
        seenFiles.has(retained.canonical) ||
        seenIdentities.has(retained.fileIdentity) ||
        sha256(retained.bytes) !== reference.sha256
      )
        return fail();
      seenFiles.add(retained.canonical);
      seenIdentities.add(retained.fileIdentity);
      reportBytes.set(label, retained.bytes);
    }
    const hostedBytes = reportBytes.get('hosted E2E');
    const axeBytes = reportBytes.get('automated accessibility');
    const voiceoverBytes = reportBytes.get('VoiceOver accessibility');
    const nvdaBytes = reportBytes.get('NVDA accessibility');
    if (!hostedBytes || !axeBytes || !voiceoverBytes || !nvdaBytes)
      return fail();

    validateAndBindRetainedHostedE2eReportV3ToVerifiedCandidate(
      hostedBytes,
      evidence.hostedE2e.report.sha256,
      input.hostedV3Verification,
      evidence,
      expected.data,
      candidate,
    );
    validateContentSchemaRegistryAutomatedAxeReportBytes(
      axeBytes,
      evidence.accessibility.automatedReport.sha256,
      evidence.accessibility,
      expected.data,
    );
    if (
      !(input.voiceoverReportBytes instanceof Uint8Array) ||
      !(input.nvdaReportBytes instanceof Uint8Array) ||
      !voiceoverBytes.equals(input.voiceoverReportBytes) ||
      !nvdaBytes.equals(input.nvdaReportBytes)
    )
      return fail();
    validateContentSchemaRegistryManualAccessibilityReportBytes(
      input.voiceoverReportBytes,
      evidence.accessibility.manualRuns[0].report.sha256,
      evidence.accessibility.manualRuns[0],
      evidence.accessibility,
      evidence.hostedE2e,
      expected.data,
    );
    validateContentSchemaRegistryManualAccessibilityReportBytes(
      input.nvdaReportBytes,
      evidence.accessibility.manualRuns[1].report.sha256,
      evidence.accessibility.manualRuns[1],
      evidence.accessibility,
      evidence.hostedE2e,
      expected.data,
    );
    if (existsSync(optionalAxeDigestPath)) {
      const sidecar = readFromRoot(
        root,
        CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
        'automated accessibility digest sidecar',
      );
      if (
        seenFiles.has(sidecar.canonical) ||
        seenIdentities.has(sidecar.fileIdentity) ||
        parseContentSchemaRegistryAutomatedAxeDigestSidecar(
          sidecar.bytes.toString('utf8'),
        ) !== evidence.accessibility.automatedReport.sha256
      )
        return fail();
    }

    return Object.freeze({
      criterion: 'P2-S09-AC-266',
      boundary: 'retained_report_byte_verification',
      status: 'report_bytes_verified',
      acceptance: 'not_claimed',
      scope: 'staging',
      environment: 'staging',
      sourceRevision: expected.data.sourceRevision,
      deploymentId: expected.data.hostedDeploymentId,
      buildId: expected.data.buildId,
      migrationVersion: expected.data.migrationVersion,
      webOrigin: expected.data.webOrigin,
      apiOrigin: expected.data.apiOrigin,
      supabaseOrigin: expected.data.supabaseOrigin,
      artifactDigest: expected.data.artifactDigest,
      candidateArchiveId: input.authenticatedCandidateArchiveId,
      candidateArchiveDigest: input.authenticatedCandidateArchiveDigest,
      candidateArchiveBytes: input.authenticatedCandidateArchiveBytes,
      hostedReportSha256: evidence.hostedE2e.report.sha256,
      axeReportSha256: evidence.accessibility.automatedReport.sha256,
      voiceoverReportSha256: evidence.accessibility.manualRuns[0].report.sha256,
      nvdaReportSha256: evidence.accessibility.manualRuns[1].report.sha256,
      roles: Object.freeze([...evidence.hostedE2e.roles]),
      scenarios: Object.freeze([...evidence.hostedE2e.scenarios]),
      trustedCutoffAt: expected.data.trustedCutoffAt,
      verifiedAt: evidence.verifiedAt,
    });
  } catch {
    return fail();
  }
};
