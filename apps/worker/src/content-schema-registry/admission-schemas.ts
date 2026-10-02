import {
  BlockLifecycleAdvanceRequestSchema,
  BlockRegistrationRequestSchema,
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  SchemaActivationRequestSchema,
  SchemaDryRunRequestSchema,
  SchemaReviewAssignmentRequestSchema,
  SchemaReviewDecisionRequestSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaSuccessorRequestSchema,
} from './contracts';
import type { HumanMutationOperationId } from './types';

/** Strict request schema of every human browser mutation. */
export const humanBodySchemas = {
  'CMS-03A-01': ContentTypeDraftRequestSchema,
  'CMS-03A-02': FieldSchemaChangeRequestSchema,
  'CMS-03A-03': RelationBindingRequestSchema,
  'CMS-03A-04': SchemaActivationRequestSchema,
  'CMS-03A-09': SchemaSuccessorRequestSchema,
  'CMS-03A-10': SchemaDryRunRequestSchema,
  'CMS-03A-11': SchemaReviewSubmissionRequestSchema,
  'CMS-03A-12': SchemaReviewDecisionRequestSchema,
  'CMS-03A-14': SchemaReviewAssignmentRequestSchema,
  'CMS-03A-15': CapabilityGrantRequestSchema,
  'CMS-03A-16': CapabilityGrantRenewalRequestSchema,
  'CMS-03A-17': CapabilityGrantRevocationRequestSchema,
} as const satisfies Readonly<Record<HumanMutationOperationId, unknown>>;

export type ParsedHumanBody = ReturnType<
  (typeof humanBodySchemas)[HumanMutationOperationId]['parse']
>;

export const schemaForHumanOperation = (
  operationId: HumanMutationOperationId,
) => humanBodySchemas[operationId];

export const schemaForReleaseOperation = (
  operationId: 'CMS-03A-05' | 'CMS-03A-08',
) =>
  operationId === 'CMS-03A-05'
    ? BlockRegistrationRequestSchema
    : BlockLifecycleAdvanceRequestSchema;
