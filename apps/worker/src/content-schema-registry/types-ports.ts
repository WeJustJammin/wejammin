import type {
  BlockLifecycleAdvanceRequest,
  BlockLifecycleEventResource,
  BlockRegistrationRequest,
  CapabilityGrantRenewalRequest,
  CapabilityGrantRequest,
  CapabilityGrantRevocationRequest,
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantListQuery,
  CmsCapabilityGrantResource,
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryListQuery,
  ContentTypeDraftRequest,
  ContentTypeVersionResource,
  FieldSchemaChangeRequest,
  RelationBindingRequest,
  RelationDefinitionResource,
  ReleaseEnvelopeHeaders,
  SchemaActivationRequest,
  SchemaActivationResource,
  SchemaDryRunRequest,
  SchemaDryRunResource,
  SchemaReviewAssignmentRequest,
  SchemaReviewAssignmentResource,
  SchemaReviewDecisionRequest,
  SchemaReviewDecisionResource,
  SchemaReviewResource,
  SchemaReviewSubmissionRequest,
  SchemaSuccessorRequest,
} from './contracts';
import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
  ReleasePrincipal,
} from './types-core';

export type ContentSchemaRegistryPortInput = Readonly<{
  operationId: ContentSchemaRegistryOperationId;
  requestId: string;
  request: Request;
  session?: ContentSchemaRegistrySession;
  principal?: ReleasePrincipal;
  path?: Readonly<Record<string, string>>;
  body?:
    | ContentTypeDraftRequest
    | FieldSchemaChangeRequest
    | RelationBindingRequest
    | SchemaActivationRequest
    | BlockRegistrationRequest
    | BlockLifecycleAdvanceRequest
    | SchemaSuccessorRequest
    | SchemaDryRunRequest
    | SchemaReviewSubmissionRequest
    | SchemaReviewDecisionRequest
    | SchemaReviewAssignmentRequest
    | CapabilityGrantRequest
    | CapabilityGrantRenewalRequest
    | CapabilityGrantRevocationRequest;
  query?: ContentSchemaRegistryListQuery | CmsCapabilityGrantListQuery;
  idempotencyKey?: string;
  ifMatch?: string;
  rawBody?: Uint8Array;
  release?: Readonly<{
    headers: ReleaseEnvelopeHeaders;
    rawBody: Uint8Array;
  }>;
}>;

export type ContentSchemaRegistryPorts = Readonly<{
  createTypeDraft: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentTypeVersionResource>>;
  addFieldDefinition: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<
    ContentSchemaRegistryResult<
      import('./contracts').FieldDefinitionVersionResource
    >
  >;
  bindRelation: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<RelationDefinitionResource>>;
  activateSchema: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaActivationResource>>;
  registerBlock: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<
    ContentSchemaRegistryResult<
      import('./contracts').BlockDefinitionVersionResource
    >
  >;
  advanceBlockLifecycle: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<BlockLifecycleEventResource>>;
  listContentTypes: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentSchemaRegistryListPage>>;
  getContentTypeVersion: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentSchemaRegistryDetail>>;
  createSchemaSuccessor: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentTypeVersionResource>>;
  startSchemaDryRun: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaDryRunResource>>;
  submitSchemaReview: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaReviewResource>>;
  decideSchemaReview: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaReviewDecisionResource>>;
  getSchemaReview: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaReviewResource>>;
  assignSchemaReview: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaReviewAssignmentResource>>;
  grantCapability: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<CmsCapabilityGrantResource>>;
  renewCapabilityGrant: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<CmsCapabilityGrantResource>>;
  revokeCapabilityGrant: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<CmsCapabilityGrantResource>>;
  listCapabilityGrants: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<CmsCapabilityGrantListPage>>;
}>;
