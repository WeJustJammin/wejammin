import { z } from 'zod';

import {
  SafeReleaseIdSchema,
  SafeReleaseTimestampSchema,
} from '../release-recovery-common.ts';
import { ReleaseArtifactIdentitySchema } from '../release-artifact.ts';
import {
  ContentSchemaRegistryAccessibilityEvidenceSchema,
  ContentSchemaRegistryHostedE2eEvidenceSchema,
} from './operational-release-evidence-browser.ts';
import {
  ReleaseEvidenceDigestSchema,
  ReleaseEvidenceHostedOriginSchema,
  ReleaseEvidenceSourceRevisionSchema,
} from './operational-release-evidence-common.ts';
import { validateHostedAndAccessibility } from './operational-release-evidence-validation.ts';

/** DEC-104's hosted identity excludes only the two production deployment fields. */
export const OperationalHostedReleaseEvidenceExpectedIdentitySchema = z
  .object({
    sourceRevision: ReleaseEvidenceSourceRevisionSchema,
    artifactDigest: ReleaseEvidenceDigestSchema,
    buildId: SafeReleaseIdSchema,
    migrationVersion: z.string().regex(/^[0-9]{14,20}$/),
    hostedEnvironment: z.enum(['staging', 'production']),
    hostedDeploymentId: SafeReleaseIdSchema,
    hostedDeployedAt: SafeReleaseTimestampSchema,
    webOrigin: ReleaseEvidenceHostedOriginSchema,
    apiOrigin: ReleaseEvidenceHostedOriginSchema,
    supabaseOrigin: ReleaseEvidenceHostedOriginSchema,
    trustedCutoffAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .readonly();

export type OperationalHostedReleaseEvidenceExpectedIdentity = z.infer<
  typeof OperationalHostedReleaseEvidenceExpectedIdentitySchema
>;

/** The hosted acceptance scope is additive; the production sidecar is unchanged. */
export const OperationalHostedReleaseEvidenceShapeSchema = z
  .object({
    artifact: ReleaseArtifactIdentitySchema,
    hostedE2e: ContentSchemaRegistryHostedE2eEvidenceSchema,
    accessibility: ContentSchemaRegistryAccessibilityEvidenceSchema,
    verifiedAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.hostedE2e.sourceRevision !== evidence.artifact.sourceRevision ||
      evidence.accessibility.sourceRevision !== evidence.artifact.sourceRevision
    )
      context.addIssue({
        code: 'custom',
        path: ['artifact', 'sourceRevision'],
        message: 'Every hosted evidence record must match the artifact SHA',
      });
    if (
      evidence.hostedE2e.migrationVersion !== evidence.artifact.migrationVersion
    )
      context.addIssue({
        code: 'custom',
        path: ['hostedE2e', 'migrationVersion'],
        message:
          'Hosted E2E evidence must match the artifact migration version',
      });

    validateHostedAndAccessibility(evidence, context);

    const verifiedAt = Date.parse(evidence.verifiedAt);
    const retainedTimestamps = [
      evidence.hostedE2e.completedAt,
      ...evidence.accessibility.manualRuns.map((run) => run.completedAt),
    ];
    if (
      retainedTimestamps.some(
        (timestamp) => Date.parse(timestamp) >= verifiedAt,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['verifiedAt'],
        message: 'Verification must occur after every retained hosted record',
      });
  })
  .readonly();

export type OperationalHostedReleaseEvidenceShape = z.infer<
  typeof OperationalHostedReleaseEvidenceShapeSchema
>;
