/**
 * One coherent positive hosted-scope fixture (DEC-104).
 *
 * The two existing fixture families describe the same candidate on two
 * different timelines:
 *
 *   * `tests/ac265-candidate-artifact-fixture.ts` (candidate files) and
 *     `tests/ac265-candidate-provenance.test-support.ts` (GitHub API payloads)
 *     encode a 2026-09-08T12:MM/13:MM run at minute precision;
 *   * the protected hosted V3 certificate chain pins its approved outage target
 *     to 2026-09-03T10:29:00.000Z–2026-09-03T12:30:00.000Z, and the V3 runner
 *     policy requires `reportStartedAt` inside that window.
 *
 * This module does not merge the families and does not pick timestamps by hand.
 * It applies ONE uniform translation to both families so every relative
 * ordering they already encode is preserved exactly:
 *
 *   2026-09-08T12:MM -> 2026-09-03T09:MM
 *   2026-09-08T13:MM -> 2026-09-03T10:MM
 *
 * Then it fixes the report window inside the outage-target attestation window
 * and mints a real WeakSet-branded provenance result from the rebased files.
 *
 * No signature, digest, or cryptographic check is bypassed or cast away.
 */

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { verifyAc265CandidateProvenance } from '../../infra/workflows/ac265-candidate-provenance.ts';
import { type Ac265VerifiedCandidateProvenance } from '../../infra/workflows/ac265-candidate-provenance-common.ts';
import { validateContentSchemaRegistryHostedE2eReportV3Bytes } from '../../infra/workflows/content-schema-registry-hosted-e2e-report-verifier.ts';
import { type ContentSchemaRegistryHostedRunnerContract } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-input.ts';
import {
  ContentSchemaRegistryHostedE2eReportV3Schema,
  type ContentSchemaRegistryHostedE2eReportV3,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-report-v3.ts';
import { createCandidateFixture } from '../ac265-candidate-artifact-fixture.ts';
import {
  createInputs,
  createMockGitHubApi,
} from '../ac265-candidate-provenance.test-support.ts';
import {
  contextFor,
  createFixture as createHostedV3Fixture,
} from './ac265-hosted-receipt-test-fixtures.ts';
import {
  jsonBytes,
  runnerContract as runnerContractFor,
} from './ac265-hosted-test-fixtures.ts';
import { CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-common.ts';
import { createManualAccessibilityReport } from './phase-02-slice-09-manual-accessibility-report-fixture.ts';

type CandidateFixture = ReturnType<typeof createCandidateFixture>;
type JsonRecord = Record<string, unknown>;

/** The fixed constraint: the protected outage-target attestation window. */
const OUTAGE_APPROVED_AT = '2026-09-03T10:29:00.000Z';
const OUTAGE_EXPIRES_AT = '2026-09-03T12:30:00.000Z';
/** The protected outage-target attestation itself. */
const OUTAGE_ATTESTATION_ISSUED_AT = '2026-09-03T10:30:00.000Z';
const OUTAGE_ATTESTATION_EXPIRES_AT = '2026-09-03T10:35:00.000Z';

/**
 * The report window is the free variable that reconciles the two signed
 * windows, which is why it spans 29 minutes:
 *
 *   * it must START inside the short outage-ATESTATION window (10:30-10:35),
 *   * it must COVER the outage lease, whose consume/release events are pinned
 *     at 10:59:15/10:59:30 by the shared lease fixture.
 */
const REPORT_STARTED_AT = '2026-09-03T10:33:00.000Z';
const REPORT_COMPLETED_AT = '2026-09-03T11:00:30.000Z';
/**
 * The lease events (10:59:15/10:59:30) and the fixture's own cleanup completion
 * (11:00:00) must all fall inside the window, so the window is built around
 * them. The report's cleanup member is deliberately left at the fixture value
 * so each retained server receipt still deep-equals its report entry.
 */
/** Artifact attestations: issued before the report start, valid across it. */
const ARTIFACT_ATTESTATION_ISSUED_AT = '2026-09-03T10:30:00.000Z';
const ARTIFACT_ATTESTATION_EXPIRES_AT = '2026-09-03T10:34:00.000Z';

/** Manual accessibility sessions, inside the post-deployment window. */
const VOICEOVER_STARTED_AT = '2026-09-03T11:01:00.000Z';
const VOICEOVER_COMPLETED_AT = '2026-09-03T11:08:00.000Z';
const NVDA_STARTED_AT = '2026-09-03T11:09:00.000Z';
const NVDA_COMPLETED_AT = '2026-09-03T11:16:00.000Z';
/** Verification must follow every retained record. */
const VERIFIED_AT = '2026-09-03T11:30:00.000Z';

const VOICEOVER_OPERATOR_ID = 'op_0123456789abcdef0123456789abcdef';
const NVDA_OPERATOR_ID = 'op_abcdef0123456789abcdef0123456789';
const TRUSTED_CUTOFF_AT = '2026-09-03T12:00:00.000Z';

/**
 * The one-use outage lease keeps the base contract's own window (10:59:00 to
 * 10:59:50, 50s <= the 60s cap) because the shared lease fixture pins its
 * consume/release events inside that span. The report window above was widened
 * to cover it.
 */

const sha256Bytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The single uniform translation. Both fixture families use minute-precision
 * 2026-09-08 timestamps, so mapping 12:MM and 13:MM preserves every relative
 * ordering they encode (including the one-hour CI/staging separation).
 */
const rebaseTimestamp = (value: string): string =>
  value
    .replace(/^2026-09-08T12:(\d{2}:\d{2}\.\d{3}Z)$/u, '2026-09-03T09:$1')
    .replace(/^2026-09-08T13:(\d{2}:\d{2}\.\d{3}Z)$/u, '2026-09-03T10:$1');

const rebaseValue = (value: unknown): unknown => {
  if (typeof value === 'string') return rebaseTimestamp(value);
  if (Array.isArray(value)) return value.map(rebaseValue);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, entry]) => [
        key,
        rebaseValue(entry),
      ]),
    );
  return value;
};

/** Rewrite every JSON candidate file onto the coherent timeline. */
const rebaseCandidateFiles = (fixture: CandidateFixture): void => {
  const paths = [
    'promotion-metadata.json',
    'staging-artifact-identity.json',
    'staging-run-identity.json',
    'provider-release-evidence.json',
    'api-p95-smoke.json',
    'staging-migration-evidence.json',
    'accessibility/axe.json',
  ];
  for (const relativePath of paths) {
    const absolutePath = join(fixture.candidateDirectory, relativePath);
    const rebased = rebaseValue(
      JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown,
    );
    const contents = `${JSON.stringify(rebased, null, 2)}\n`;
    writeFileSync(absolutePath, contents);
    if (relativePath === 'accessibility/axe.json')
      writeFileSync(
        join(fixture.candidateDirectory, 'accessibility', 'axe.sha256'),
        `${sha256Bytes(Buffer.from(contents, 'utf8'))}  accessibility/axe.json\n`,
      );
  }
};

/**
 * Rebase the mock GitHub API payloads with the SAME translation the files got,
 * so the API and the candidate bytes stay mutually consistent.
 */
const rebasedMockApi = () => {
  const defaults = createMockGitHubApi();
  const rebased = rebaseValue(defaults.values) as {
    readonly ciRun: unknown;
    readonly stagingRun: unknown;
    readonly ciArtifacts: readonly unknown[];
    readonly stagingArtifacts: readonly unknown[];
    readonly deployments: readonly unknown[];
    readonly deploymentStatuses: readonly unknown[];
  };
  const api = createMockGitHubApi({
    ciRun: rebased.ciRun,
    stagingRun: rebased.stagingRun,
    ciArtifacts: rebased.ciArtifacts,
    stagingArtifacts: rebased.stagingArtifacts,
    deployments: rebased.deployments,
    deploymentStatuses: rebased.deploymentStatuses,
  });
  // The archive length is API-reported and carried by the provenance brand.
  // Neither this fixture nor the brand recomputes a ZIP archive digest.
  const stagingArtifact = rebased.stagingArtifacts[0] as
    { readonly size_in_bytes?: unknown } | undefined;
  const artifactBytes = stagingArtifact?.size_in_bytes;
  return {
    api,
    stagingArtifactArchiveBytes:
      typeof artifactBytes === 'number' ? artifactBytes : 0,
  };
};

export interface CoherentHostedScopeFixture {
  readonly candidate: CandidateFixture;
  readonly provenance: Ac265VerifiedCandidateProvenance;
  readonly contract: ContentSchemaRegistryHostedRunnerContract;
  readonly report: ContentSchemaRegistryHostedE2eReportV3;
  readonly reportBytes: Uint8Array;
  /** Result of the real V3 byte verifier over the coherent bytes. */
  readonly verifiedReport: ContentSchemaRegistryHostedE2eReportV3;
  /** Root holding the exact retained report bytes named by the sidecar. */
  readonly reportRoot: string;
  /** The hosted-scope sidecar: exactly the four DEC-104 members. */
  readonly sidecar: JsonRecord;
  readonly sidecarPath: string;
  /** Exact secret-supplied manual report bytes. */
  readonly voiceoverReportBytes: Uint8Array;
  readonly nvdaReportBytes: Uint8Array;
  /** The rebased candidate axe report bytes and their pinned digest. */
  readonly axeReportBytes: Uint8Array;
  readonly axeReportDigest: string;
  /**
   * The protected hosted V3 verification material for THIS candidate.
   *
   * `runnerContractBytes` are the exact contract bytes the report binds, and
   * `verificationContext` is the certificate chain re-signed for this same
   * contract, so a consumer can re-verify the retained report bytes. Reusing a
   * verification context minted for a different candidate would silently bind
   * the wrong identity, which is exactly the mismatch this field removes.
   */
  readonly hostedV3Verification: Readonly<{
    runnerContractBytes: Uint8Array;
    verificationContext: ReturnType<typeof contextFor>;
  }>;
  /**
   * Candidate ARCHIVE facts, kept separate from the axe report digest.
   *
   * Provenance note, stated so no caller over-claims the brand:
   *   * `artifactId` and `artifactDigest` come from the branded result, which
   *     carries both. The brand authenticates the GitHub API artifact identity
   *     (id, name, digest shape, run/branch/sha bindings) and the extracted
   *     candidate FILES — it does NOT recompute a ZIP archive digest.
   *   * `archiveBytes` comes from the authenticated GitHub API artifact
   *     payload (`size_in_bytes`) and is carried by the branded result. It
   *     remains an API-reported length, not proof of downloaded ZIP bytes.
   *   * Enforcing archive BYTES is the job of the ID-based download action's
   *     `digest-mismatch: error`, which is outside this fixture and outside the
   *     brand. A composed production trust chain needs that action; the brand
   *     alone does not authenticate archive bytes.
   */
  readonly candidateArchive: Readonly<{
    artifactId: number;
    artifactDigest: string;
    archiveBytes: number;
  }>;
  /** The hosted-only expected identity, derived from the same candidate. */
  readonly expectedHostedIdentity: JsonRecord;
  close: () => void;
}

export const createCoherentHostedScopeFixture =
  async (): Promise<CoherentHostedScopeFixture> => {
    const candidate = createCandidateFixture();
    rebaseCandidateFiles(candidate);

    const mock = rebasedMockApi();
    const provenance = await verifyAc265CandidateProvenance(
      createInputs(candidate),
      mock.api.fetchImpl,
    );
    if (provenance.staging.artifactBytes !== mock.stagingArtifactArchiveBytes)
      throw new Error('Coherent fixture archive length is not bound.');

    const base = runnerContractFor();
    const contract = runnerContractFor({
      identity: {
        ...base.identity,
        sourceRevision: provenance.sourceRevision,
        deploymentId: provenance.staging.deploymentId,
        deployedAt: provenance.staging.deployedAt,
        // The runner commits to the CI workspace archive, not the distinct
        // deployment-manifest digest carried by the release sidecar.
        artifactSha256: provenance.ci.artifactDigest.slice('sha256:'.length),
        buildId: provenance.artifact.buildId,
        migrationVersion: provenance.artifact.migrationVersion,
        webOrigin: provenance.staging.webOrigin,
        apiOrigin: provenance.staging.apiOrigin,
        supabaseProjectRef: provenance.migration.projectRef,
        supabaseOrigin: `https://${provenance.migration.projectRef}.supabase.co`,
      },
      scenarioParameters: {
        ...base.scenarioParameters,
        dependencyOutage: {
          ...base.scenarioParameters.dependencyOutage,
        },
      },
    });

    const certificate = createHostedV3Fixture({
      contract,
      includeCandidateIdentityReceipt: true,
      includeExecutionBindings: true,
      // Every server receipt must carry an issuedAt inside the execution
      // window, and the cleanup receipt must not precede cleanup completion
      // (11:00:00), so the shared value sits between them and inside the
      // report window.
      receiptIssuedAt: '2026-09-03T11:00:05.000Z',
    });
    const report: ContentSchemaRegistryHostedE2eReportV3 = {
      ...certificate.report,
      startedAt: REPORT_STARTED_AT,
      completedAt: REPORT_COMPLETED_AT,
    };
    const parsed =
      ContentSchemaRegistryHostedE2eReportV3Schema.safeParse(report);
    if (!parsed.success)
      throw new Error(
        `Coherent fixture report is invalid at: ${parsed.error.issues
          .map((issue) => issue.path.join('.'))
          .slice(0, 3)
          .join(', ')}`,
      );

    const verificationContext = contextFor(certificate, contract, {
      receipt: {
        issuedAt: ARTIFACT_ATTESTATION_ISSUED_AT,
        expiresAt: ARTIFACT_ATTESTATION_EXPIRES_AT,
      },
      evidence: {
        issuedAt: ARTIFACT_ATTESTATION_ISSUED_AT,
        expiresAt: ARTIFACT_ATTESTATION_EXPIRES_AT,
      },
    });
    const reportBytes = jsonBytes(report);
    const verifiedReport = validateContentSchemaRegistryHostedE2eReportV3Bytes(
      reportBytes,
      sha256Bytes(reportBytes),
      jsonBytes(contract),
      verificationContext,
    );

    // --- retained bytes, sidecar, and hosted-only identity ---
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ac265-coherent-'));
    const reportRoot = join(workspaceRoot, 'reports');
    mkdirSync(reportRoot);
    const writeRetained = (relativePath: string, contents: string): void => {
      const absolutePath = join(reportRoot, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, contents);
    };

    const axeReportBytes = readFileSync(
      join(candidate.candidateDirectory, 'accessibility', 'axe.json'),
    );
    const axeReportDigest = sha256Bytes(axeReportBytes);
    const hostedReportContents = Buffer.from(reportBytes).toString('utf8');

    const manualReport = (
      platform: 'mac_safari_voiceover' | 'windows_firefox_nvda',
      operatorId: string,
      startedAt: string,
      completedAt: string,
    ): string =>
      `${JSON.stringify(
        {
          ...createManualAccessibilityReport(platform),
          sourceRevision: contract.identity.sourceRevision,
          environment: 'staging',
          deploymentId: contract.identity.deploymentId,
          webOrigin: contract.identity.webOrigin,
          operatorId,
          startedAt,
          completedAt,
        },
        null,
        2,
      )}\n`;

    const voiceoverContents = manualReport(
      'mac_safari_voiceover',
      VOICEOVER_OPERATOR_ID,
      VOICEOVER_STARTED_AT,
      VOICEOVER_COMPLETED_AT,
    );
    const nvdaContents = manualReport(
      'windows_firefox_nvda',
      NVDA_OPERATOR_ID,
      NVDA_STARTED_AT,
      NVDA_COMPLETED_AT,
    );

    writeRetained('hosted/e2e.json', hostedReportContents);
    writeRetained('accessibility/axe.json', axeReportBytes.toString('utf8'));
    writeRetained(
      'accessibility/macos-voiceover-safari.json',
      voiceoverContents,
    );
    writeRetained('accessibility/windows-nvda-firefox.json', nvdaContents);

    const reportReference = (path: string, contents: string): JsonRecord => ({
      path,
      sha256: sha256Bytes(Buffer.from(contents)),
    });

    const manualRun = (
      platform: 'macos_voiceover_safari' | 'windows_nvda_firefox',
      operatorId: string,
      completedAt: string,
      contents: string,
      path: string,
    ): JsonRecord => ({
      platform,
      operator: operatorId,
      osVersion:
        platform === 'macos_voiceover_safari'
          ? 'macos-15.6'
          : 'windows-11.24h2',
      browserVersion:
        platform === 'macos_voiceover_safari' ? 'safari-18.6' : 'firefox-142.0',
      screenReaderVersion:
        platform === 'macos_voiceover_safari'
          ? 'voiceover-15.6'
          : 'nvda-2025.2',
      report: reportReference(path, contents),
      completedAt,
      outcome: 'passed',
      checks: [...CONTENT_SCHEMA_REGISTRY_MANUAL_A11Y_CHECKS],
    });

    const sidecar: JsonRecord = {
      artifact: {
        artifactDigest: provenance.artifact.artifactDigest,
        sourceRevision: contract.identity.sourceRevision,
        buildId: contract.identity.buildId,
        migrationVersion: contract.identity.migrationVersion,
      },
      hostedE2e: {
        sourceRevision: contract.identity.sourceRevision,
        environment: 'staging',
        deploymentId: contract.identity.deploymentId,
        migrationVersion: contract.identity.migrationVersion,
        webOrigin: contract.identity.webOrigin,
        apiOrigin: contract.identity.apiOrigin,
        supabaseOrigin: contract.identity.supabaseOrigin,
        idpProvider: 'google',
        report: reportReference('hosted/e2e.json', hostedReportContents),
        completedAt: REPORT_COMPLETED_AT,
        roles: Object.keys(contract.roleResourceBindings),
        scenarios: Object.keys(contract.scenarioRoleBindings),
      },
      accessibility: {
        sourceRevision: contract.identity.sourceRevision,
        environment: 'staging',
        deploymentId: contract.identity.deploymentId,
        webOrigin: contract.identity.webOrigin,
        automatedReport: reportReference(
          'accessibility/axe.json',
          axeReportBytes.toString('utf8'),
        ),
        axeSerious: 0,
        axeCritical: 0,
        manualRuns: [
          manualRun(
            'macos_voiceover_safari',
            VOICEOVER_OPERATOR_ID,
            VOICEOVER_COMPLETED_AT,
            voiceoverContents,
            'accessibility/macos-voiceover-safari.json',
          ),
          manualRun(
            'windows_nvda_firefox',
            NVDA_OPERATOR_ID,
            NVDA_COMPLETED_AT,
            nvdaContents,
            'accessibility/windows-nvda-firefox.json',
          ),
        ],
      },
      verifiedAt: VERIFIED_AT,
    };
    const sidecarPath = join(workspaceRoot, 'hosted-scope-sidecar.json');
    writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));

    return Object.freeze({
      candidate,
      provenance,
      contract,
      report,
      reportBytes,
      verifiedReport,
      reportRoot,
      sidecar,
      sidecarPath,
      voiceoverReportBytes: Buffer.from(voiceoverContents),
      nvdaReportBytes: Buffer.from(nvdaContents),
      axeReportBytes,
      axeReportDigest,
      hostedV3Verification: Object.freeze({
        runnerContractBytes: jsonBytes(contract),
        verificationContext,
      }),
      candidateArchive: Object.freeze({
        artifactId: provenance.staging.artifactId,
        artifactDigest: provenance.staging.artifactDigest,
        // The API-reported length is also carried by the branded result.
        archiveBytes: provenance.staging.artifactBytes,
      }),
      expectedHostedIdentity: {
        sourceRevision: contract.identity.sourceRevision,
        artifactDigest: provenance.artifact.artifactDigest,
        buildId: contract.identity.buildId,
        migrationVersion: contract.identity.migrationVersion,
        hostedEnvironment: 'staging',
        hostedDeploymentId: contract.identity.deploymentId,
        hostedDeployedAt: contract.identity.deployedAt,
        webOrigin: contract.identity.webOrigin,
        apiOrigin: contract.identity.apiOrigin,
        supabaseOrigin: contract.identity.supabaseOrigin,
        trustedCutoffAt: TRUSTED_CUTOFF_AT,
      },
      close: () => {
        candidate.close();
        rmSync(workspaceRoot, { recursive: true, force: true });
      },
    });
  };

/** The one timeline every coherent-fixture product shares. */
export const coherentTimeline = Object.freeze({
  outageApprovedAt: OUTAGE_APPROVED_AT,
  outageExpiresAt: OUTAGE_EXPIRES_AT,
  outageAttestationIssuedAt: OUTAGE_ATTESTATION_ISSUED_AT,
  outageAttestationExpiresAt: OUTAGE_ATTESTATION_EXPIRES_AT,
  reportStartedAt: REPORT_STARTED_AT,
  reportCompletedAt: REPORT_COMPLETED_AT,
  artifactAttestationIssuedAt: ARTIFACT_ATTESTATION_ISSUED_AT,
  artifactAttestationExpiresAt: ARTIFACT_ATTESTATION_EXPIRES_AT,
  trustedCutoffAt: TRUSTED_CUTOFF_AT,
});
