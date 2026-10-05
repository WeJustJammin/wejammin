/**
 * Parsed contract aliases for worker feature-local callers.
 *
 * Each alias derives from the shared schema parser so this module cannot drift
 * into a second runtime contract definition.
 */
import {
  BlockDefinitionRegistryRecordSchema,
  BlockDefinitionVersionResourceSchema,
  BlockLifecycleAdvanceRequestSchema,
  BlockLifecycleEventReceiptSchema,
  BlockLifecycleEventResourceSchema,
  BlockRegistrationRequestSchema,
  CapabilityBindingResourceSchema,
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantListQuerySchema,
  CmsCapabilityGrantResourceSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryRecordSchema,
  ContentTypeDraftRequestSchema,
  ContentTypeResourceSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionInputSchema,
  FieldDefinitionVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingInputSchema,
  RelationBindingRequestSchema,
  RelationDefinitionResourceSchema,
  ReleaseEnvelopeHeadersSchema,
  SchemaActivationRequestSchema,
  SchemaActivationResourceSchema,
  SchemaArtifactResourceSchema,
  SchemaDryRunRequestSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentRequestSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionRequestSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaSuccessorRequestSchema,
  TemplateBindingResourceSchema,
} from '@wejammin/contracts';

export type BlockLifecycleAdvanceRequest = ReturnType<
  typeof BlockLifecycleAdvanceRequestSchema.parse
>;
export type BlockLifecycleEventReceipt = ReturnType<
  typeof BlockLifecycleEventReceiptSchema.parse
>;
export type BlockLifecycleEventResource = ReturnType<
  typeof BlockLifecycleEventResourceSchema.parse
>;
export type BlockRegistrationRequest = ReturnType<
  typeof BlockRegistrationRequestSchema.parse
>;
export type BlockDefinitionRegistryRecord = ReturnType<
  typeof BlockDefinitionRegistryRecordSchema.parse
>;
export type BlockDefinitionVersionResource = ReturnType<
  typeof BlockDefinitionVersionResourceSchema.parse
>;
export type CapabilityBindingResource = ReturnType<
  typeof CapabilityBindingResourceSchema.parse
>;
export type ContentSchemaRegistryDetail = ReturnType<
  typeof ContentSchemaRegistryDetailSchema.parse
>;
export type ContentSchemaRegistryListPage = ReturnType<
  typeof ContentSchemaRegistryListPageSchema.parse
>;
export type ContentSchemaRegistryListQuery = ReturnType<
  typeof ContentSchemaRegistryListQuerySchema.parse
>;
export type ContentSchemaRegistryRecord = ReturnType<
  typeof ContentSchemaRegistryRecordSchema.parse
>;
export type ContentTypeDraftRequest = ReturnType<
  typeof ContentTypeDraftRequestSchema.parse
>;
export type ContentTypeResource = ReturnType<
  typeof ContentTypeResourceSchema.parse
>;
export type ContentTypeVersionResource = ReturnType<
  typeof ContentTypeVersionResourceSchema.parse
>;
export type FieldDefinitionInput = ReturnType<
  typeof FieldDefinitionInputSchema.parse
>;
export type FieldDefinitionVersionResource = ReturnType<
  typeof FieldDefinitionVersionResourceSchema.parse
>;
export type FieldSchemaChangeRequest = ReturnType<
  typeof FieldSchemaChangeRequestSchema.parse
>;
export type RelationBindingInput = ReturnType<
  typeof RelationBindingInputSchema.parse
>;
export type RelationBindingRequest = ReturnType<
  typeof RelationBindingRequestSchema.parse
>;
export type RelationDefinitionResource = ReturnType<
  typeof RelationDefinitionResourceSchema.parse
>;
export type ReleaseEnvelopeHeaders = ReturnType<
  typeof ReleaseEnvelopeHeadersSchema.parse
>;
export type SchemaActivationRequest = ReturnType<
  typeof SchemaActivationRequestSchema.parse
>;
export type SchemaActivationResource = ReturnType<
  typeof SchemaActivationResourceSchema.parse
>;
export type SchemaArtifactResource = ReturnType<
  typeof SchemaArtifactResourceSchema.parse
>;
export type TemplateBindingResource = ReturnType<
  typeof TemplateBindingResourceSchema.parse
>;
export type SchemaSuccessorRequest = ReturnType<
  typeof SchemaSuccessorRequestSchema.parse
>;
export type SchemaDryRunRequest = ReturnType<
  typeof SchemaDryRunRequestSchema.parse
>;
export type SchemaDryRunResource = ReturnType<
  typeof SchemaDryRunResourceSchema.parse
>;
export type SchemaReviewSubmissionRequest = ReturnType<
  typeof SchemaReviewSubmissionRequestSchema.parse
>;
export type SchemaReviewDecisionRequest = ReturnType<
  typeof SchemaReviewDecisionRequestSchema.parse
>;
export type SchemaReviewAssignmentRequest = ReturnType<
  typeof SchemaReviewAssignmentRequestSchema.parse
>;
export type SchemaReviewResource = ReturnType<
  typeof SchemaReviewResourceSchema.parse
>;
export type SchemaReviewDecisionResource = ReturnType<
  typeof SchemaReviewDecisionResourceSchema.parse
>;
export type SchemaReviewAssignmentResource = ReturnType<
  typeof SchemaReviewAssignmentResourceSchema.parse
>;
export type CapabilityGrantRequest = ReturnType<
  typeof CapabilityGrantRequestSchema.parse
>;
export type CapabilityGrantRenewalRequest = ReturnType<
  typeof CapabilityGrantRenewalRequestSchema.parse
>;
export type CapabilityGrantRevocationRequest = ReturnType<
  typeof CapabilityGrantRevocationRequestSchema.parse
>;
export type CmsCapabilityGrantListQuery = ReturnType<
  typeof CmsCapabilityGrantListQuerySchema.parse
>;
export type CmsCapabilityGrantResource = ReturnType<
  typeof CmsCapabilityGrantResourceSchema.parse
>;
export type CmsCapabilityGrantListPage = ReturnType<
  typeof CmsCapabilityGrantListPageSchema.parse
>;
