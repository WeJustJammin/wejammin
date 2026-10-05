export type ContentSchemaRegistryCapability =
  | 'cms.schema_designer'
  | 'cms.schema_registry.read'
  | 'cms.schema_review'
  | 'cms.schema_review.assign'
  | 'release.block_registry.write';

export type ContentSchemaRegistryCapabilityMode = 'any_of' | 'all_of';

export type ContentSchemaRegistryRequestSchemaName =
  | 'ContentTypeDraftRequestSchema'
  | 'FieldSchemaChangeRequestSchema'
  | 'RelationBindingRequestSchema'
  | 'SchemaActivationRequestSchema'
  | 'BlockRegistrationRequestSchema'
  | 'ContentSchemaRegistryListQuerySchema'
  | 'ContentSchemaRegistryDetailParamsSchema'
  | 'BlockLifecycleAdvanceRequestSchema'
  | 'SchemaSuccessorRequestSchema'
  | 'SchemaDryRunRequestSchema'
  | 'SchemaReviewSubmissionRequestSchema'
  | 'SchemaReviewDecisionRequestSchema'
  | 'SchemaReviewDetailParamsSchema'
  | 'SchemaReviewAssignmentRequestSchema'
  | 'CapabilityGrantRequestSchema'
  | 'CapabilityGrantRenewalRequestSchema'
  | 'CapabilityGrantRevocationRequestSchema'
  | 'CmsCapabilityGrantListQuerySchema';

export type ContentSchemaRegistrySuccessSchemaName =
  | 'ContentTypeVersionResourceSchema'
  | 'FieldDefinitionVersionResourceSchema'
  | 'RelationDefinitionResourceSchema'
  | 'SchemaActivationResourceSchema'
  | 'BlockDefinitionVersionResourceSchema'
  | 'ContentSchemaRegistryListPageSchema'
  | 'ContentSchemaRegistryDetailSchema'
  | 'BlockLifecycleEventResourceSchema'
  | 'SchemaDryRunResourceSchema'
  | 'SchemaReviewResourceSchema'
  | 'SchemaReviewDecisionResourceSchema'
  | 'SchemaReviewAssignmentResourceSchema'
  | 'CmsCapabilityGrantResourceSchema'
  | 'CmsCapabilityGrantListPageSchema';

export type ContentSchemaRegistryOpenApiSuccessSchemaName =
  | 'ContentTypeVersionResourceSchema'
  | 'FieldDefinitionVersionResourceSchema'
  | 'RelationDefinitionResourceSchema'
  | 'SchemaActivationResourceSchema'
  | 'BlockDefinitionRegistryRecordSchema'
  | 'ContentSchemaRegistryListPageSchema'
  | 'ContentSchemaRegistryDetailSchema'
  | 'BlockLifecycleEventReceiptSchema'
  | 'SchemaDryRunResourceSchema'
  | 'SchemaReviewResourceSchema'
  | 'SchemaReviewDecisionResourceSchema'
  | 'SchemaReviewAssignmentResourceSchema'
  | 'CmsCapabilityGrantResourceSchema'
  | 'CmsCapabilityGrantListPageSchema';

export type ContentSchemaRegistryPath =
  | '/api/v1/cms/content-types'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate'
  | '/api/v1/cms/blocks/versions'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}'
  | '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs'
  | '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews'
  | '/api/v1/cms/schema-reviews/{reviewId}/decisions'
  | '/api/v1/cms/schema-reviews/{reviewId}'
  | '/api/v1/cms/schema-reviews/{reviewId}/assignments'
  | '/api/v1/cms/capability-grants'
  | '/api/v1/cms/capability-grants/{grantId}/renewals'
  | '/api/v1/cms/capability-grants/{grantId}/revocations';

export type ContentSchemaRegistryErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'STEP_UP_REQUIRED'
  | 'WEBHOOK_REJECTED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR';

export type ContentSchemaRegistryErrorStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type RouteContract = {
  method: 'GET' | 'POST';
  path: ContentSchemaRegistryPath;
  requestSchema: ContentSchemaRegistryRequestSchemaName;
  successSchema: ContentSchemaRegistrySuccessSchemaName;
  openApiSuccessSchema?: ContentSchemaRegistryOpenApiSuccessSchemaName;
  successStatus: 200 | 201 | 202;
  successStatuses?: readonly (200 | 201 | 202)[];
  auth:
    | 'schema_designer'
    | 'registry_reader'
    | 'schema_reviewer'
    | 'review_reader'
    | 'review_assigner'
    | 'cms_owner'
    | 'signed_release_worker';
  /**
   * Absent on the owner-only routes (CMS-03A-15 through CMS-03A-18), whose
   * authority is the receipt-derived owner and never a capability key.
   */
  capability?: ContentSchemaRegistryCapability;
  capabilities?: readonly ContentSchemaRegistryCapability[];
  /** Whether a caller needs `any_of` or `all_of` the listed capabilities. */
  capabilityMode?: ContentSchemaRegistryCapabilityMode;
  audience: 'browser' | 'release-worker';
  cors: 'cms-console' | 'release-worker';
  csrf: 'required' | 'forbidden' | 'none';
  /** `required` when missing or stale MFA is 401 `STEP_UP_REQUIRED`. */
  stepUp: 'required' | 'none';
  rawBodySignature: 'required' | 'none';
  idempotency: 'required' | 'none';
  ifMatch: 'required' | 'none';
  rateClass:
    | 'cms-definition-write'
    | 'cms-activation'
    | 'cms-definition-read'
    | 'release-registry-write'
    | 'release-registry-lifecycle';
  rateLimit: number;
  partyRateLimit?: number;
  rateWindowSeconds: 60;
  rateScope: 'user' | 'release';
  timeoutMs: 15_000;
  cacheControl: 'no-store';
  slo: Readonly<{
    tier: 2;
    commandP95Ms: 1_200;
    protectedRpcP95Ms: 300;
    acceptanceP99Ms: 1_000;
  }>;
};
