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
  ContentSchemaRegistryAlertingEvidenceSchema,
  ContentSchemaRegistrySloEvidenceSchema,
} from './operational-release-evidence-observability.ts';
import {
  ReleaseEvidenceDigestSchema,
  ReleaseEvidenceHostedOriginSchema,
  ReleaseEvidenceSourceRevisionSchema,
} from './operational-release-evidence-common.ts';
import { validateOperationalReleaseEvidence } from './operational-release-evidence-validation.ts';

export * from './operational-release-evidence-browser.ts';
export * from './operational-release-evidence-axe-report.ts';
export * from './operational-release-evidence-automated-a11y.ts';
export * from './operational-release-evidence-collector.ts';
export * from './operational-release-evidence-common.ts';
export * from './operational-release-evidence-hosted-control-plane.ts';
export * from './operational-release-evidence-hosted-candidate-enrollment.ts';
export * from './operational-release-evidence-observability.ts';
export * from './operational-release-evidence-hosted-input.ts';
export * from './operational-release-evidence-hosted-receipt.ts';
export * from './operational-release-evidence-hosted-report.ts';
export * from './operational-release-evidence-hosted-scope.ts';
export * from './operational-release-evidence-manual-accessibility-report.ts';
export * from './operational-release-evidence-provider.ts';

export const OperationalReleaseEvidenceExpectedIdentitySchema = z
  .object({
    sourceRevision: ReleaseEvidenceSourceRevisionSchema,
    artifactDigest: ReleaseEvidenceDigestSchema,
    buildId: SafeReleaseIdSchema,
    migrationVersion: z.string().regex(/^[0-9]{14,20}$/),
    productionDeploymentId: SafeReleaseIdSchema,
    productionDeployedAt: SafeReleaseTimestampSchema,
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

export type OperationalReleaseEvidenceExpectedIdentity = z.infer<
  typeof OperationalReleaseEvidenceExpectedIdentitySchema
>;

export const OperationalReleaseEvidenceShapeSchema = z
  .object({
    artifact: ReleaseArtifactIdentitySchema,
    alerting: ContentSchemaRegistryAlertingEvidenceSchema,
    slo: ContentSchemaRegistrySloEvidenceSchema,
    hostedE2e: ContentSchemaRegistryHostedE2eEvidenceSchema,
    accessibility: ContentSchemaRegistryAccessibilityEvidenceSchema,
    verifiedAt: SafeReleaseTimestampSchema,
  })
  .strict()
  .readonly();

export type OperationalReleaseEvidenceShape = z.infer<
  typeof OperationalReleaseEvidenceShapeSchema
>;

export const ContentSchemaRegistryOperationalReleaseEvidenceSchema =
  OperationalReleaseEvidenceShapeSchema.superRefine(
    validateOperationalReleaseEvidence,
  ).readonly();

export type ContentSchemaRegistryOperationalReleaseEvidence = z.infer<
  typeof ContentSchemaRegistryOperationalReleaseEvidenceSchema
>;
