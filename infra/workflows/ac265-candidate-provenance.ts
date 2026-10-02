import {
  AC265_CANDIDATE_ARTIFACT_NAME,
  AC265_CI_WORKFLOW_PATH,
  AC265_REPOSITORY,
  AC265_STAGING_WORKFLOW_PATH,
  type Ac265Fetch,
  type Ac265VerifiedCandidateProvenance,
} from './ac265-candidate-provenance-common.ts';
import { verifyAc265CandidateArtifactFiles } from './ac265-candidate-provenance-artifact.ts';
import { verifyAc265GitHubCandidateProvenance } from './ac265-candidate-provenance-github.ts';
import {
  type Ac265CandidateProvenanceInputs,
  validateAc265CandidateProvenanceInputs,
} from './ac265-candidate-provenance-input.ts';
import { ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-candidate-enrollment.ts';

const verifiedCandidates = new WeakSet<object>();

/**
 * Freeze every reachable object and array so nothing can mutate the branded
 * result after verification. The WeakSet brand proves the shape was produced
 * by this verifier; the deep freeze keeps the bound values stable while a
 * consumer reads them, including the authenticated archive length and the
 * candidate axe report digest.
 */
const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') return value;
  for (const entry of Object.values(value as Record<string, unknown>))
    deepFreeze(entry);
  return Object.freeze(value);
};

export const isVerifiedAc265CandidateProvenance = (
  value: unknown,
): value is Ac265VerifiedCandidateProvenance =>
  typeof value === 'object' && value !== null && verifiedCandidates.has(value);

export const verifyAc265CandidateProvenance = async (
  untrustedInputs: unknown,
  fetchImpl: Ac265Fetch = fetch,
): Promise<Ac265VerifiedCandidateProvenance> => {
  const input: Ac265CandidateProvenanceInputs =
    validateAc265CandidateProvenanceInputs(untrustedInputs);
  const trusted = await verifyAc265GitHubCandidateProvenance(input, fetchImpl);
  const artifact = verifyAc265CandidateArtifactFiles(input, trusted);
  const { migration, provider, ...artifactIdentity } = artifact;

  const result =
    ContentSchemaRegistryAc265VerifiedCandidateProvenanceSchema.parse({
      status: 'candidate_provenance_verified',
      repository: AC265_REPOSITORY,
      sourceRevision: input.sourceSha,
      ci: {
        runId: trusted.ciRun.runId,
        runAttempt: trusted.ciRun.runAttempt,
        workflowPath: AC265_CI_WORKFLOW_PATH,
        artifactName: `workspace-build-${input.sourceSha}`,
        artifactId: trusted.ciArtifact.id,
        artifactDigest: trusted.ciArtifact.digest,
      },
      staging: {
        runId: trusted.stagingRun.runId,
        runAttempt: trusted.stagingRun.runAttempt,
        workflowPath: AC265_STAGING_WORKFLOW_PATH,
        artifactName: AC265_CANDIDATE_ARTIFACT_NAME,
        artifactId: trusted.stagingArtifact.id,
        artifactDigest: trusted.stagingArtifact.digest,
        artifactBytes: trusted.stagingArtifact.sizeInBytes,
        deploymentId: trusted.deployment.id,
        deployedAt: new Date(trusted.deployment.createdAt).toISOString(),
        environment: trusted.deployment.environment,
        webOrigin: trusted.deployment.webOrigin,
        apiOrigin: input.stagingApiOrigin,
      },
      artifact: artifactIdentity,
      migration,
      provider,
    });
  const branded = deepFreeze(result);
  verifiedCandidates.add(branded);
  return branded;
};
