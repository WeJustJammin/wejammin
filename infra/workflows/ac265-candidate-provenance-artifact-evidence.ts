import { TextDecoder } from 'node:util';
import { join } from 'node:path';

import {
  ReleaseApiP95EvidenceSchema,
  type ReleaseArtifactIdentity,
} from '../../packages/contracts/src/release-artifact.ts';
import { CloudflareProviderReleaseEvidenceSchema } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-provider.ts';
import { ContentSchemaRegistryAutomatedAxeReportSchema } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import { verifyStagingCandidateMetadata } from '../verify-release-promotion.ts';
import {
  AC265_STAGING_WORKFLOW_PATH,
  type Ac265CandidateProvenanceInputs,
  type Ac265GitHubProvenance,
  failAc265CandidateProvenance,
  isAc265Record,
  parseJsonBytes,
  timestampMs,
} from './ac265-candidate-provenance-common.ts';
import {
  readAc265CandidateJsonFile,
  readAc265CandidateRegularFile,
  sha256Ac265CandidateBytes,
} from './ac265-candidate-provenance-artifact-files.ts';
import { validateContentSchemaRegistryAutomatedAxeReport } from './content-schema-registry-axe-report-verifier.ts';

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const MIGRATION_PATTERN = /^[0-9]{14,20}$/u;
const MAX_JSON_BYTES = 1024 * 1024;

export interface Ac265VerifiedCandidateEvidenceFiles {
  readonly axeReportSha256: string;
  readonly migration: Readonly<{
    projectRef: string;
    remoteHistorySha256: string;
    verifiedAt: string;
  }>;
  readonly provider: Readonly<{
    evidenceSha256: string;
    collectedAt: string;
    workers: readonly Readonly<{
      workerName: 'wejammin-api-staging' | 'wejammin-web-staging';
      versionId: string;
      deploymentId: string;
      versionCreatedAt: string;
      deploymentCreatedAt: string;
    }>[];
  }>;
}

const parseStagingRunIdentity = (
  value: unknown,
  input: Ac265CandidateProvenanceInputs,
  trusted: Ac265GitHubProvenance,
): void => {
  const expectedKeys = [
    'schemaVersion',
    'repository',
    'workflowPath',
    'runId',
    'runAttempt',
    'headSha',
  ];
  if (
    !isAc265Record(value) ||
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key)) ||
    value.schemaVersion !== 'ac266-staging-run-identity-v1' ||
    value.repository !== input.repository ||
    value.workflowPath !== AC265_STAGING_WORKFLOW_PATH ||
    value.runId !== trusted.stagingRun.runId ||
    value.runAttempt !== trusted.stagingRun.runAttempt ||
    value.headSha !== input.sourceSha
  )
    return failAc265CandidateProvenance();
};

const parseMigrationEvidence = (
  value: unknown,
  input: Ac265CandidateProvenanceInputs,
  trusted: Ac265GitHubProvenance,
  migrationVersion: string,
): Ac265VerifiedCandidateEvidenceFiles['migration'] => {
  const expectedKeys = [
    'appliedVersions',
    'ciRunId',
    'destructiveRollbackAttempted',
    'environment',
    'forwardFixOnly',
    'migrationVersion',
    'projectRef',
    'remoteHistorySha256',
    'sourceRevision',
    'state',
    'verifiedAt',
  ];
  if (
    !isAc265Record(value) ||
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key)) ||
    value.environment !== 'staging' ||
    value.ciRunId !== trusted.ciRun.runId ||
    value.sourceRevision !== input.sourceSha ||
    value.migrationVersion !== migrationVersion ||
    !Array.isArray(value.appliedVersions) ||
    value.appliedVersions.length === 0 ||
    value.appliedVersions.at(-1) !== migrationVersion ||
    value.appliedVersions.some(
      (version) =>
        typeof version !== 'string' || !MIGRATION_PATTERN.test(version),
    ) ||
    typeof value.projectRef !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{5,62}$/u.test(value.projectRef) ||
    typeof value.remoteHistorySha256 !== 'string' ||
    !HASH_PATTERN.test(value.remoteHistorySha256) ||
    value.state !== 'expanded' ||
    value.forwardFixOnly !== true ||
    value.destructiveRollbackAttempted !== false
  )
    return failAc265CandidateProvenance();
  const verifiedAt = timestampMs(value.verifiedAt);
  if (
    verifiedAt < trusted.deployment.createdAt ||
    verifiedAt > trusted.stagingRun.completedAt
  )
    return failAc265CandidateProvenance();
  return {
    projectRef: value.projectRef,
    remoteHistorySha256: value.remoteHistorySha256,
    verifiedAt: new Date(verifiedAt).toISOString(),
  };
};

export const verifyAc265CandidateEvidenceFiles = (
  candidateDirectory: string,
  input: Ac265CandidateProvenanceInputs,
  trusted: Ac265GitHubProvenance,
  identity: ReleaseArtifactIdentity,
): Ac265VerifiedCandidateEvidenceFiles => {
  const promotionMetadata = readAc265CandidateJsonFile(
    join(candidateDirectory, 'promotion-metadata.json'),
  );
  const promotion = verifyStagingCandidateMetadata(promotionMetadata, identity);
  if (
    promotion.artifact.sourceRevision !== input.sourceSha ||
    promotion.artifact.buildId !== identity.buildId ||
    promotion.artifact.artifactDigest !== identity.artifactDigest ||
    promotion.artifact.migrationVersion !== identity.migrationVersion ||
    promotion.performance.apiP95.mode !== 'staging' ||
    promotion.performance.apiP95.origin !== input.stagingApiOrigin
  )
    return failAc265CandidateProvenance();
  const promotionVerifiedAt = timestampMs(promotion.verifiedAt);
  if (
    promotionVerifiedAt < trusted.deployment.createdAt ||
    promotionVerifiedAt > trusted.stagingRun.completedAt
  )
    return failAc265CandidateProvenance();

  parseStagingRunIdentity(
    readAc265CandidateJsonFile(
      join(candidateDirectory, 'staging-run-identity.json'),
    ),
    input,
    trusted,
  );
  const migration = parseMigrationEvidence(
    readAc265CandidateJsonFile(
      join(candidateDirectory, 'staging-migration-evidence.json'),
    ),
    input,
    trusted,
    identity.migrationVersion,
  );

  const providerEvidenceBytes = readAc265CandidateRegularFile(
    join(candidateDirectory, 'provider-release-evidence.json'),
    MAX_JSON_BYTES,
  );
  const providerResult = CloudflareProviderReleaseEvidenceSchema.safeParse(
    parseJsonBytes(providerEvidenceBytes),
  );
  if (
    !providerResult.success ||
    providerResult.data.sourceRevision !== input.sourceSha ||
    providerResult.data.githubRunId !== trusted.stagingRun.runId ||
    timestampMs(providerResult.data.collectedAt) <
      trusted.deployment.createdAt ||
    timestampMs(providerResult.data.collectedAt) >
      trusted.stagingRun.completedAt ||
    providerResult.data.workers.some(
      (worker) =>
        timestampMs(worker.versionCreatedAt) < trusted.deployment.createdAt ||
        timestampMs(worker.deploymentCreatedAt) < trusted.deployment.createdAt,
    )
  )
    return failAc265CandidateProvenance();

  const axeBytes = readAc265CandidateRegularFile(
    join(candidateDirectory, 'accessibility', 'axe.json'),
    MAX_JSON_BYTES,
  );
  const axeDigestBytes = readAc265CandidateRegularFile(
    join(candidateDirectory, 'accessibility', 'axe.sha256'),
    256,
  );
  const axeDigestText = new TextDecoder('utf-8', { fatal: true }).decode(
    axeDigestBytes,
  );
  const axeReportSha256 = sha256Ac265CandidateBytes(axeBytes);
  const axeDigestMatch =
    /^([a-f0-9]{64}) {2}accessibility\/axe\.json\n?$/u.exec(axeDigestText);
  if (axeDigestMatch === null || axeDigestMatch[1] !== axeReportSha256)
    return failAc265CandidateProvenance();
  const axeReport = ContentSchemaRegistryAutomatedAxeReportSchema.safeParse(
    parseJsonBytes(axeBytes),
  );
  if (!axeReport.success) return failAc265CandidateProvenance();
  validateContentSchemaRegistryAutomatedAxeReport(axeReport.data, undefined, {
    sourceRevision: input.sourceSha,
    hostedEnvironment: 'staging',
    hostedDeploymentId: input.stagingDeploymentId,
    hostedDeployedAt: new Date(trusted.deployment.createdAt).toISOString(),
    trustedCutoffAt: new Date(trusted.stagingRun.completedAt).toISOString(),
    webOrigin: input.stagingWebOrigin,
  });

  const p95Evidence = ReleaseApiP95EvidenceSchema.safeParse(
    readAc265CandidateJsonFile(join(candidateDirectory, 'api-p95-smoke.json')),
  );
  if (
    !p95Evidence.success ||
    p95Evidence.data.sourceRevision !== input.sourceSha ||
    p95Evidence.data.mode !== 'staging' ||
    p95Evidence.data.origin !== input.stagingApiOrigin ||
    p95Evidence.data.p95Ms !== promotion.performance.apiP95.p95Ms ||
    p95Evidence.data.samples !== promotion.performance.apiP95.samples
  )
    return failAc265CandidateProvenance();

  const marker = readAc265CandidateRegularFile(
    join(candidateDirectory, 'staging-verification.passed'),
    1,
  );
  if (marker.length !== 0) return failAc265CandidateProvenance();

  return {
    axeReportSha256,
    migration,
    provider: {
      evidenceSha256: sha256Ac265CandidateBytes(providerEvidenceBytes),
      collectedAt: providerResult.data.collectedAt,
      workers: providerResult.data.workers.map((worker) => ({
        workerName: worker.workerName,
        versionId: worker.versionId,
        deploymentId: worker.deploymentId,
        versionCreatedAt: worker.versionCreatedAt,
        deploymentCreatedAt: worker.deploymentCreatedAt,
      })),
    },
  };
};
