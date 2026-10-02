import {
  AC265_STAGING_HOSTING_PROJECT_ID,
  ContentSchemaRegistryAc265CandidateEnrollmentProvenanceSchema,
  ContentSchemaRegistryAc265CandidateEnrollmentProtectedConfigSchema,
  ContentSchemaRegistryAc265CandidateEnrollmentRequestSchema,
  ContentSchemaRegistryAc265HostedRunnerIdentitySchema,
  ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema,
  sha256Ac265HostedRunnerIdentity,
  type Ac265CandidateEnrollmentProtectedConfig,
  type ContentSchemaRegistryAc265CandidateEnrollmentRequest,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-candidate-enrollment.ts';
import { AC265_STAGING_API_ORIGIN } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-control-plane.ts';
import type { Ac265VerifiedCandidateProvenance } from './ac265-candidate-provenance-common.ts';
import { isVerifiedAc265CandidateProvenance } from './ac265-candidate-provenance.ts';

const FAILURE = 'AC265 verified candidate enrollment request is invalid';

export const buildAc265CandidateEnrollment = async (
  candidate: Ac265VerifiedCandidateProvenance,
  protectedConfiguration: Ac265CandidateEnrollmentProtectedConfig,
): Promise<ContentSchemaRegistryAc265CandidateEnrollmentRequest> => {
  if (!isVerifiedAc265CandidateProvenance(candidate)) throw new Error(FAILURE);
  const verifiedResult =
    ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema.safeParse(
      candidate,
    );
  const configurationResult =
    ContentSchemaRegistryAc265CandidateEnrollmentProtectedConfigSchema.safeParse(
      protectedConfiguration,
    );
  if (!verifiedResult.success || !configurationResult.success)
    throw new Error(FAILURE);

  const verified = verifiedResult.data;
  const configuration = configurationResult.data;
  if (
    configuration.stagingWebOrigin !== verified.staging.webOrigin ||
    configuration.stagingApiOrigin !== AC265_STAGING_API_ORIGIN ||
    configuration.stagingApiOrigin !== verified.staging.apiOrigin ||
    configuration.supabaseProjectRef !== verified.migration.projectRef ||
    configuration.supabaseOrigin !==
      `https://${configuration.supabaseProjectRef}.supabase.co`
  )
    throw new Error(FAILURE);

  const identityResult =
    ContentSchemaRegistryAc265HostedRunnerIdentitySchema.safeParse({
      environment: 'staging',
      ciRunId: verified.ci.runId,
      ciRunAttempt: Number(verified.ci.runAttempt),
      stagingRunId: verified.staging.runId,
      stagingRunAttempt: Number(verified.staging.runAttempt),
      sourceRevision: verified.sourceRevision,
      deploymentId: verified.staging.deploymentId,
      deployedAt: verified.staging.deployedAt,
      buildId: verified.artifact.buildId,
      buildManifestSha256: verified.artifact.artifactDigest,
      artifactSha256: verified.ci.artifactDigest.slice('sha256:'.length),
      hostingAccountId: configuration.hostingAccountId,
      hostingProjectId: AC265_STAGING_HOSTING_PROJECT_ID,
      supabaseProjectRef: configuration.supabaseProjectRef,
      migrationVersion: verified.artifact.migrationVersion,
      migrationSha256: verified.migration.remoteHistorySha256,
      webOrigin: configuration.stagingWebOrigin,
      apiOrigin: configuration.stagingApiOrigin,
      supabaseOrigin: configuration.supabaseOrigin,
    });
  if (!identityResult.success) throw new Error(FAILURE);

  const provenanceResult =
    ContentSchemaRegistryAc265CandidateEnrollmentProvenanceSchema.safeParse({
      repository: verified.repository,
      sourceRevision: verified.sourceRevision,
      ci: {
        ...verified.ci,
        runAttempt: Number(verified.ci.runAttempt),
      },
      staging: {
        // The authenticated archive length is verifier-only: the frozen
        // enrollment RPC key set does not accept it, so it is not copied
        // into the persisted request.
        runId: verified.staging.runId,
        runAttempt: Number(verified.staging.runAttempt),
        workflowPath: verified.staging.workflowPath,
        artifactName: verified.staging.artifactName,
        artifactId: verified.staging.artifactId,
        artifactDigest: verified.staging.artifactDigest,
        deploymentId: verified.staging.deploymentId,
        deployedAt: verified.staging.deployedAt,
        environment: verified.staging.environment,
        webOrigin: verified.staging.webOrigin,
        apiOrigin: verified.staging.apiOrigin,
      },
      artifact: {
        buildId: verified.artifact.buildId,
        buildManifestSha256: verified.artifact.artifactDigest,
        migrationVersion: verified.artifact.migrationVersion,
      },
      migration: verified.migration,
      provider: verified.provider,
    });
  if (!provenanceResult.success) throw new Error(FAILURE);

  let identitySha256: string;
  try {
    identitySha256 = await sha256Ac265HostedRunnerIdentity(identityResult.data);
  } catch {
    throw new Error(FAILURE);
  }

  const requestResult =
    ContentSchemaRegistryAc265CandidateEnrollmentRequestSchema.safeParse({
      criterion: 'P2-S09-AC-265',
      schemaVersion: 'ac265-candidate-enrollment-v1',
      identitySha256,
      identity: identityResult.data,
      provenance: provenanceResult.data,
    });
  if (!requestResult.success) throw new Error(FAILURE);
  return requestResult.data;
};
