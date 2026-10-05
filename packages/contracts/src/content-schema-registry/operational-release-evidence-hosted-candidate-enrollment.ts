import { z } from 'zod';

import {
  SafeReleaseIdSchema,
  SafeReleaseTimestampSchema,
} from '../release-recovery-common.ts';
import {
  ReleaseEvidenceDigestSchema,
  ReleaseEvidenceHostedOriginSchema,
  ReleaseEvidenceSourceRevisionSchema,
} from './operational-release-evidence-common.ts';
import { AC265_STAGING_API_ORIGIN } from './operational-release-evidence-hosted-control-plane.ts';
import { ContentSchemaRegistryHostedRunnerIdentitySchema } from './operational-release-evidence-hosted-input-identity.ts';
import { CloudflareStagingWorkerNameSchema } from './operational-release-evidence-provider.ts';

export const AC265_CANDIDATE_ENROLLMENT_SCHEMA_VERSION =
  'ac265-candidate-enrollment-v1' as const;
export const AC265_STAGING_HOSTING_PROJECT_ID = 'wejammin-staging' as const;

const GitHubRunIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/u);
const GitHubArtifactDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const AC265_MAX_AUTHENTICATED_ARTIFACT_BYTES = 1024 * 1024 * 1024;
const GitHubRunAttemptSchema = z.number().int().positive().max(1_000);
const GitHubArtifactIdSchema = z.number().int().positive().safe();
const SupabaseProjectRefSchema = z.string().regex(/^[a-z0-9]{20}$/u);
const MigrationVersionSchema = z.string().regex(/^[0-9]{14,20}$/u);
const ProviderUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);

export const ContentSchemaRegistryAc265HostedRunnerIdentitySchema =
  ContentSchemaRegistryHostedRunnerIdentitySchema.superRefine(
    (identity, context) => {
      if (identity.apiOrigin !== AC265_STAGING_API_ORIGIN)
        context.addIssue({
          code: 'custom',
          path: ['apiOrigin'],
          message: 'AC265 runner API origin must match the pinned staging API',
        });
      if (identity.hostingProjectId !== AC265_STAGING_HOSTING_PROJECT_ID)
        context.addIssue({
          code: 'custom',
          path: ['hostingProjectId'],
          message: 'AC265 runner hosting project must be the staging project',
        });
    },
  );

export type ContentSchemaRegistryAc265HostedRunnerIdentity = z.infer<
  typeof ContentSchemaRegistryAc265HostedRunnerIdentitySchema
>;

const Ac265CandidateEnrollmentCiProvenanceSchema = z
  .object({
    runId: GitHubRunIdSchema,
    runAttempt: GitHubRunAttemptSchema,
    workflowPath: z.literal('.github/workflows/ci.yml'),
    artifactName: z.string().min(1).max(200),
    artifactId: GitHubArtifactIdSchema,
    artifactDigest: GitHubArtifactDigestSchema,
  })
  .strict()
  .readonly();

const Ac265CandidateEnrollmentStagingProvenanceSchema = z
  .object({
    runId: GitHubRunIdSchema,
    runAttempt: GitHubRunAttemptSchema,
    workflowPath: z.literal('.github/workflows/deploy-staging.yml'),
    artifactName: z.literal('staging-verified-candidate'),
    artifactId: GitHubArtifactIdSchema,
    artifactDigest: GitHubArtifactDigestSchema,
    deploymentId: SafeReleaseIdSchema,
    deployedAt: SafeReleaseTimestampSchema,
    environment: z.literal('staging'),
    webOrigin: ReleaseEvidenceHostedOriginSchema,
    apiOrigin: z.literal(AC265_STAGING_API_ORIGIN),
  })
  .strict()
  .readonly();

const Ac265CandidateEnrollmentArtifactProvenanceSchema = z
  .object({
    buildId: SafeReleaseIdSchema,
    buildManifestSha256: ReleaseEvidenceDigestSchema,
    migrationVersion: MigrationVersionSchema,
  })
  .strict()
  .readonly();

const Ac265CandidateEnrollmentMigrationProvenanceSchema = z
  .object({
    projectRef: SupabaseProjectRefSchema,
    remoteHistorySha256: ReleaseEvidenceDigestSchema,
    verifiedAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .readonly();

const Ac265CandidateEnrollmentProviderWorkerSchema = z
  .object({
    workerName: CloudflareStagingWorkerNameSchema,
    versionId: ProviderUuidSchema,
    deploymentId: ProviderUuidSchema,
    versionCreatedAt: SafeReleaseTimestampSchema,
    deploymentCreatedAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .readonly();

const Ac265CandidateEnrollmentProviderProvenanceSchema = z
  .object({
    evidenceSha256: ReleaseEvidenceDigestSchema,
    collectedAt: SafeReleaseTimestampSchema,
    workers: z
      .array(Ac265CandidateEnrollmentProviderWorkerSchema)
      .length(2)
      .readonly(),
  })
  .strict()
  .superRefine((provider, context) => {
    const names = provider.workers.map(({ workerName }) => workerName);
    if (new Set(names).size !== names.length)
      context.addIssue({
        code: 'custom',
        path: ['workers'],
        message: 'Each staging Worker must have one provider record',
      });
  })
  .readonly();

export const ContentSchemaRegistryAc265CandidateEnrollmentProvenanceSchema = z
  .object({
    repository: z.literal('WeJustJammin/wejammin'),
    sourceRevision: ReleaseEvidenceSourceRevisionSchema,
    ci: Ac265CandidateEnrollmentCiProvenanceSchema,
    staging: Ac265CandidateEnrollmentStagingProvenanceSchema,
    artifact: Ac265CandidateEnrollmentArtifactProvenanceSchema,
    migration: Ac265CandidateEnrollmentMigrationProvenanceSchema,
    provider: Ac265CandidateEnrollmentProviderProvenanceSchema,
  })
  .strict()
  .superRefine((provenance, context) => {
    if (
      provenance.ci.artifactName !==
      `workspace-build-${provenance.sourceRevision}`
    )
      context.addIssue({
        code: 'custom',
        path: ['ci', 'artifactName'],
        message: 'CI build artifact must be bound to the verified source SHA',
      });
  })
  .readonly();

export type ContentSchemaRegistryAc265CandidateEnrollmentProvenance = z.infer<
  typeof ContentSchemaRegistryAc265CandidateEnrollmentProvenanceSchema
>;

export const ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema = z
  .object({
    status: z.literal('candidate_provenance_verified'),
    repository: z.literal('WeJustJammin/wejammin'),
    sourceRevision: ReleaseEvidenceSourceRevisionSchema,
    ci: z
      .object({
        runId: GitHubRunIdSchema,
        runAttempt: z.string().regex(/^[1-9][0-9]{0,5}$/u),
        workflowPath: z.literal('.github/workflows/ci.yml'),
        artifactName: z.string().min(1).max(200),
        artifactId: GitHubArtifactIdSchema,
        artifactDigest: GitHubArtifactDigestSchema,
      })
      .strict()
      .readonly(),
    staging: z
      .object({
        runId: GitHubRunIdSchema,
        runAttempt: z.string().regex(/^[1-9][0-9]{0,5}$/u),
        workflowPath: z.literal('.github/workflows/deploy-staging.yml'),
        artifactName: z.literal('staging-verified-candidate'),
        artifactId: GitHubArtifactIdSchema,
        artifactDigest: GitHubArtifactDigestSchema,
        artifactBytes: z
          .number()
          .int()
          .positive()
          .max(AC265_MAX_AUTHENTICATED_ARTIFACT_BYTES),
        deploymentId: SafeReleaseIdSchema,
        deployedAt: SafeReleaseTimestampSchema,
        environment: z.literal('staging'),
        webOrigin: ReleaseEvidenceHostedOriginSchema,
        apiOrigin: z.literal(AC265_STAGING_API_ORIGIN),
      })
      .strict()
      .readonly(),
    artifact: z
      .object({
        artifactDigest: ReleaseEvidenceDigestSchema,
        axeReportSha256: ReleaseEvidenceDigestSchema,
        buildId: SafeReleaseIdSchema,
        migrationVersion: MigrationVersionSchema,
      })
      .strict()
      .readonly(),
    migration: Ac265CandidateEnrollmentMigrationProvenanceSchema,
    provider: Ac265CandidateEnrollmentProviderProvenanceSchema,
  })
  .strict()
  .readonly();

export type ContentSchemaRegistryAc265VerifiedCandidateProvenance = z.infer<
  typeof ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema
>;

export const ContentSchemaRegistryAc265CandidateEnrollmentRequestSchema = z
  .object({
    criterion: z.literal('P2-S09-AC-265'),
    schemaVersion: z.literal(AC265_CANDIDATE_ENROLLMENT_SCHEMA_VERSION),
    identitySha256: ReleaseEvidenceDigestSchema,
    identity: ContentSchemaRegistryAc265HostedRunnerIdentitySchema,
    provenance: ContentSchemaRegistryAc265CandidateEnrollmentProvenanceSchema,
  })
  .strict()
  .superRefine((request, context) => {
    const { identity, provenance } = request;
    const mismatch = (path: (string | number)[], message: string): void => {
      context.addIssue({ code: 'custom', path, message });
    };

    if (identity.sourceRevision !== provenance.sourceRevision)
      mismatch(['identity', 'sourceRevision'], 'Source revision is not bound');
    if (
      identity.ciRunId !== provenance.ci.runId ||
      identity.ciRunAttempt !== provenance.ci.runAttempt
    )
      mismatch(['identity', 'ciRunId'], 'CI run attempt is not bound');
    if (
      identity.stagingRunId !== provenance.staging.runId ||
      identity.stagingRunAttempt !== provenance.staging.runAttempt
    )
      mismatch(
        ['identity', 'stagingRunId'],
        'Staging run attempt is not bound',
      );
    if (
      identity.deploymentId !== provenance.staging.deploymentId ||
      identity.deployedAt !== provenance.staging.deployedAt ||
      identity.environment !== provenance.staging.environment
    )
      mismatch(['identity', 'deploymentId'], 'Staging deployment is not bound');
    if (
      identity.buildId !== provenance.artifact.buildId ||
      identity.buildManifestSha256 !==
        provenance.artifact.buildManifestSha256 ||
      identity.migrationVersion !== provenance.artifact.migrationVersion
    )
      mismatch(['identity', 'buildId'], 'Verified build identity is not bound');
    if (
      identity.artifactSha256 !==
      provenance.ci.artifactDigest.slice('sha256:'.length)
    )
      mismatch(
        ['identity', 'artifactSha256'],
        'CI build artifact digest is not bound',
      );
    if (
      identity.migrationSha256 !== provenance.migration.remoteHistorySha256 ||
      identity.supabaseProjectRef !== provenance.migration.projectRef
    )
      mismatch(
        ['identity', 'migrationSha256'],
        'Verified staging migration is not bound',
      );
    if (
      identity.webOrigin !== provenance.staging.webOrigin ||
      identity.apiOrigin !== provenance.staging.apiOrigin
    )
      mismatch(
        ['identity', 'webOrigin'],
        'Verified staging origins are not bound',
      );
  })
  .readonly();

export type ContentSchemaRegistryAc265CandidateEnrollmentRequest = z.infer<
  typeof ContentSchemaRegistryAc265CandidateEnrollmentRequestSchema
>;

const AC265_CANDIDATE_REFERENCE =
  /^ac265-candidate:\/\/staging\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const ContentSchemaRegistryAc265CandidateEnrollmentResultSchema = z
  .object({
    criterion: z.literal('P2-S09-AC-265'),
    schemaVersion: z.literal(AC265_CANDIDATE_ENROLLMENT_SCHEMA_VERSION),
    candidateRef: z.string().regex(AC265_CANDIDATE_REFERENCE),
    identitySha256: ReleaseEvidenceDigestSchema,
    status: z.literal('enrolled'),
    redacted: z.literal(true),
  })
  .strict()
  .readonly();

export type ContentSchemaRegistryAc265CandidateEnrollmentResult = z.infer<
  typeof ContentSchemaRegistryAc265CandidateEnrollmentResultSchema
>;

export const serializeAc265HostedRunnerIdentityForDigest = (
  value: unknown,
): string =>
  JSON.stringify(ContentSchemaRegistryHostedRunnerIdentitySchema.parse(value));

export const sha256Ac265HostedRunnerIdentity = async (
  value: unknown,
): Promise<string> => {
  const bytes = new TextEncoder().encode(
    serializeAc265HostedRunnerIdentityForDigest(value),
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

export const ContentSchemaRegistryAc265CandidateEnrollmentProtectedConfigSchema =
  z
    .object({
      hostingAccountId: z.string().regex(/^[0-9a-f]{32}$/u),
      stagingWebOrigin: ReleaseEvidenceHostedOriginSchema,
      stagingApiOrigin: z.literal(AC265_STAGING_API_ORIGIN),
      supabaseProjectRef: SupabaseProjectRefSchema,
      supabaseOrigin: ReleaseEvidenceHostedOriginSchema,
    })
    .strict()
    .readonly();

export type Ac265CandidateEnrollmentProtectedConfig = z.infer<
  typeof ContentSchemaRegistryAc265CandidateEnrollmentProtectedConfigSchema
>;
