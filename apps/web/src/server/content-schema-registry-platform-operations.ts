import {
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsCapabilityGrantResourceSchema,
  ContentTypeDraftRequestSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationRequestSchema,
  SchemaActivationResourceSchema,
  SchemaDryRunRequestSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentRequestSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionRequestSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaSuccessorRequestSchema,
} from '@wejammin/contracts';

/**
 * Browser-facing human mutation operations (BE03a CMS-03A-01..04, 09..12, 14
 * and the owner-only grant commands 15..17).
 */
export type ContentSchemaRegistryMutationOperationId =
  | 'CMS-03A-01'
  | 'CMS-03A-02'
  | 'CMS-03A-03'
  | 'CMS-03A-04'
  | 'CMS-03A-09'
  | 'CMS-03A-10'
  | 'CMS-03A-11'
  | 'CMS-03A-12'
  | 'CMS-03A-14'
  | 'CMS-03A-15'
  | 'CMS-03A-16'
  | 'CMS-03A-17';

/**
 * Path identifiers the first-party route supplies. Version-scoped operations
 * carry `{contentTypeId, versionId}`; review-scoped ones carry `{reviewId}`.
 * The browser never chooses these; the Astro route binds them from its path.
 */
export interface ContentSchemaRegistryMutationTarget {
  readonly operationId: ContentSchemaRegistryMutationOperationId;
  readonly contentTypeId?: string;
  readonly versionId?: string;
  readonly reviewId?: string;
  readonly grantId?: string;
}

export type ContentSchemaRegistryMutationScope =
  'none' | 'version' | 'review' | 'grant';

const VERSION =
  '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}';
const REVIEW = '/api/v1/cms/schema-reviews/{reviewId}';
const GRANTS = '/api/v1/cms/capability-grants';

/** The browser facade's operation map mirrors the generated BE03a registry. */
export const CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS = {
  'CMS-03A-01': {
    method: 'POST',
    scope: 'none',
    path: '/api/v1/cms/content-types',
    requestSchema: ContentTypeDraftRequestSchema,
    successSchema: ContentTypeVersionResourceSchema,
    successStatuses: [201],
    requiresIfMatch: false,
  },
  'CMS-03A-02': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/fields`,
    requestSchema: FieldSchemaChangeRequestSchema,
    successSchema: FieldDefinitionVersionResourceSchema,
    successStatuses: [201],
    requiresIfMatch: true,
  },
  'CMS-03A-03': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/relations`,
    requestSchema: RelationBindingRequestSchema,
    successSchema: RelationDefinitionResourceSchema,
    successStatuses: [201],
    requiresIfMatch: true,
  },
  'CMS-03A-04': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/activate`,
    requestSchema: SchemaActivationRequestSchema,
    successSchema: SchemaActivationResourceSchema,
    successStatuses: [200, 202],
    requiresIfMatch: true,
  },
  'CMS-03A-09': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/successors`,
    requestSchema: SchemaSuccessorRequestSchema,
    successSchema: ContentTypeVersionResourceSchema,
    successStatuses: [201],
    requiresIfMatch: true,
  },
  'CMS-03A-10': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/dry-runs`,
    requestSchema: SchemaDryRunRequestSchema,
    successSchema: SchemaDryRunResourceSchema,
    successStatuses: [202],
    requiresIfMatch: true,
  },
  'CMS-03A-11': {
    method: 'POST',
    scope: 'version',
    path: `${VERSION}/reviews`,
    requestSchema: SchemaReviewSubmissionRequestSchema,
    successSchema: SchemaReviewResourceSchema,
    successStatuses: [201],
    requiresIfMatch: true,
  },
  'CMS-03A-12': {
    method: 'POST',
    scope: 'review',
    path: `${REVIEW}/decisions`,
    requestSchema: SchemaReviewDecisionRequestSchema,
    successSchema: SchemaReviewDecisionResourceSchema,
    successStatuses: [201],
    requiresIfMatch: true,
  },
  'CMS-03A-14': {
    method: 'POST',
    scope: 'review',
    path: `${REVIEW}/assignments`,
    requestSchema: SchemaReviewAssignmentRequestSchema,
    successSchema: SchemaReviewAssignmentResourceSchema,
    successStatuses: [200, 201],
    requiresIfMatch: true,
  },
  'CMS-03A-15': {
    method: 'POST',
    scope: 'none',
    path: GRANTS,
    requestSchema: CapabilityGrantRequestSchema,
    successSchema: CmsCapabilityGrantResourceSchema,
    successStatuses: [201],
    requiresIfMatch: false,
  },
  'CMS-03A-16': {
    method: 'POST',
    scope: 'grant',
    path: `${GRANTS}/{grantId}/renewals`,
    requestSchema: CapabilityGrantRenewalRequestSchema,
    successSchema: CmsCapabilityGrantResourceSchema,
    successStatuses: [200],
    requiresIfMatch: true,
  },
  'CMS-03A-17': {
    method: 'POST',
    scope: 'grant',
    path: `${GRANTS}/{grantId}/revocations`,
    requestSchema: CapabilityGrantRevocationRequestSchema,
    successSchema: CmsCapabilityGrantResourceSchema,
    successStatuses: [200],
    requiresIfMatch: true,
  },
} as const satisfies Readonly<
  Record<
    ContentSchemaRegistryMutationOperationId,
    Readonly<{
      method: 'POST';
      scope: ContentSchemaRegistryMutationScope;
      path: string;
      requestSchema: unknown;
      successSchema: unknown;
      successStatuses: readonly (200 | 201 | 202)[];
      requiresIfMatch: boolean;
    }>
  >
>;

export const isContentSchemaRegistryMutationOperationId = (
  value: string,
): value is ContentSchemaRegistryMutationOperationId =>
  Object.hasOwn(CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS, value);
