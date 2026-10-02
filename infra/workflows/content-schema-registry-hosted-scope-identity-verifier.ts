import {
  OperationalHostedReleaseEvidenceExpectedIdentitySchema,
  OperationalHostedReleaseEvidenceShapeSchema,
  type OperationalHostedReleaseEvidenceShape,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-scope.ts';

type TrustedNow = () => number;

/**
 * Bind DEC-104's hosted-only evidence to a trusted staging candidate identity.
 * This validates identity and time bounds, not retained report authenticity;
 * the hosted-scope consumer must also verify each exact report body.
 */
export const validateContentSchemaRegistryOperationalHostedReleaseEvidence = (
  evidence: unknown,
  expectedReleaseIdentity: unknown,
  now: TrustedNow = Date.now,
): OperationalHostedReleaseEvidenceShape => {
  const expected =
    OperationalHostedReleaseEvidenceExpectedIdentitySchema.safeParse(
      expectedReleaseIdentity,
    );
  if (!expected.success)
    throw new Error('Expected hosted release identity is invalid.');
  const parsed =
    OperationalHostedReleaseEvidenceShapeSchema.safeParse(evidence);
  if (!parsed.success)
    throw new Error('Content schema registry hosted evidence is invalid.');

  if (
    expected.data.hostedEnvironment !== 'staging' ||
    parsed.data.hostedE2e.environment !== 'staging'
  )
    throw new Error('Hosted acceptance requires the staging environment.');
  if (parsed.data.artifact.sourceRevision !== expected.data.sourceRevision)
    throw new Error('Hosted evidence does not match the expected source SHA.');
  if (parsed.data.artifact.artifactDigest !== expected.data.artifactDigest)
    throw new Error(
      'Hosted evidence does not match the expected artifact digest.',
    );
  if (
    parsed.data.artifact.buildId !== expected.data.buildId ||
    parsed.data.artifact.migrationVersion !== expected.data.migrationVersion
  )
    throw new Error(
      'Hosted evidence does not match the expected build identity.',
    );
  if (
    parsed.data.hostedE2e.environment !== expected.data.hostedEnvironment ||
    parsed.data.hostedE2e.deploymentId !== expected.data.hostedDeploymentId ||
    parsed.data.hostedE2e.webOrigin !== expected.data.webOrigin ||
    parsed.data.hostedE2e.apiOrigin !== expected.data.apiOrigin ||
    parsed.data.hostedE2e.supabaseOrigin !== expected.data.supabaseOrigin
  )
    throw new Error(
      'Hosted evidence does not match the expected hosted target.',
    );

  const deployedAt = Date.parse(expected.data.hostedDeployedAt);
  const cutoffAt = Date.parse(expected.data.trustedCutoffAt);
  if (deployedAt > cutoffAt)
    throw new Error(
      'Expected hosted release identity time bounds are invalid.',
    );
  const trustedNow = now();
  if (!Number.isFinite(trustedNow))
    throw new Error('Trusted hosted release clock is invalid.');
  if (cutoffAt > trustedNow)
    throw new Error('Trusted hosted release evidence cutoff is in the future.');

  const retainedTimestamps = [
    parsed.data.hostedE2e.completedAt,
    ...parsed.data.accessibility.manualRuns.map((run) => run.completedAt),
    parsed.data.verifiedAt,
  ].map((timestamp) => Date.parse(timestamp));
  if (retainedTimestamps.some((timestamp) => timestamp < deployedAt))
    throw new Error('Hosted evidence predates the expected deployment.');
  if (retainedTimestamps.some((timestamp) => timestamp > cutoffAt))
    throw new Error('Hosted evidence exceeds the trusted cutoff.');

  return parsed.data;
};
