/**
 * Shared field maps and fixtures for the Slice 09 operation-boundary suites.
 * Every fixture is parsed by the completed contract schema in the tests, so a
 * drifted fixture fails loudly.
 */
import {
  BlockDefinitionVersionResourceSchema,
  BlockLifecycleAdvanceRequestSchema,
  BlockLifecycleEventResourceSchema,
  BlockRegistrationRequestSchema,
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantListQuerySchema,
  CmsCapabilityGrantResourceSchema,
  ContentSchemaRegistryDetailParamsSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
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
  SchemaReviewDetailParamsSchema,
  SchemaReviewResourceSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaSuccessorRequestSchema,
  contentSchemaRegistryRoutePolicies,
} from '../../packages/contracts/src/content-schema-registry';
import {
  blockRegistrationErrors,
  humanDetailErrors,
  humanListErrors,
  humanMutationErrors,
  humanStepUpMutationErrors,
  releaseErrors,
  reviewDetailErrors,
} from '../../packages/contracts/src/content-schema-registry/routes-errors';
import {
  GRANT_OPERATIONS,
  SUBJECT_PERSON_ID,
  grantListPage,
  grantResource,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-grants-test-support';
import {
  REVIEW_ID,
  assignCreateBody,
  assignmentCreated,
  decisionBody,
  decisionResource,
  detailWithPreparation,
  dryRunBody,
  dryRunResource,
  reviewResource,
  submitBody,
  successorBody,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-test-values';
import {
  activation,
  block,
  field,
  lifecycleEvent,
  relation,
  resource,
  safeBlock,
  validActivation,
  validBlock,
  validDraft,
  validField,
  validLifecycle,
  validRelation,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';
import { type OperationId } from './phase-02-slice-09-operation-boundaries-fields';
import { listQueryWithOptionalFields } from './phase-02-slice-09-list-query-options-fixtures';

export type ParseSchema = Readonly<{
  safeParse: (value: unknown) => { readonly success: boolean };
}>;

const grantBody = (operationId: 'CMS-03A-15' | 'CMS-03A-16' | 'CMS-03A-17') =>
  GRANT_OPERATIONS.find((spec) => spec.operationId === operationId)?.body ?? {};

export const requestSchemas: Readonly<Record<string, ParseSchema>> = {
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  SchemaActivationRequestSchema,
  BlockRegistrationRequestSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryDetailParamsSchema,
  BlockLifecycleAdvanceRequestSchema,
  SchemaSuccessorRequestSchema,
  SchemaDryRunRequestSchema,
  SchemaReviewSubmissionRequestSchema,
  SchemaReviewDecisionRequestSchema,
  SchemaReviewDetailParamsSchema,
  SchemaReviewAssignmentRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsCapabilityGrantListQuerySchema,
};

export const successSchemas: Readonly<Record<string, ParseSchema>> = {
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationResourceSchema,
  BlockDefinitionVersionResourceSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryDetailSchema,
  BlockLifecycleEventResourceSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  CmsCapabilityGrantResourceSchema,
  CmsCapabilityGrantListPageSchema,
};

export const requestFixtures: Readonly<Record<string, object>> = {
  ContentTypeDraftRequestSchema: validDraft,
  FieldSchemaChangeRequestSchema: validField,
  RelationBindingRequestSchema: validRelation,
  SchemaActivationRequestSchema: validActivation,
  BlockRegistrationRequestSchema: validBlock,
  ContentSchemaRegistryListQuerySchema: listQueryWithOptionalFields,
  ContentSchemaRegistryDetailParamsSchema: {
    contentTypeId: '30000000-0000-4000-8000-000000000003',
    versionId: '40000000-0000-4000-8000-000000000004',
  },
  BlockLifecycleAdvanceRequestSchema: validLifecycle,
  SchemaSuccessorRequestSchema: successorBody,
  SchemaDryRunRequestSchema: dryRunBody,
  SchemaReviewSubmissionRequestSchema: submitBody,
  SchemaReviewDecisionRequestSchema: decisionBody,
  SchemaReviewDetailParamsSchema: { reviewId: REVIEW_ID },
  SchemaReviewAssignmentRequestSchema: assignCreateBody,
  CapabilityGrantRequestSchema: grantBody('CMS-03A-15'),
  CapabilityGrantRenewalRequestSchema: grantBody('CMS-03A-16'),
  CapabilityGrantRevocationRequestSchema: grantBody('CMS-03A-17'),
  CmsCapabilityGrantListQuerySchema: {
    subjectPersonId: SUBJECT_PERSON_ID,
    capability: 'cms.author',
    state: 'active',
    limit: 25,
    cursor: 'abc_DEF-123',
    sort: 'validThrough',
    direction: 'asc',
  },
};

export const successFixtures: Readonly<Record<string, unknown>> = {
  ContentTypeVersionResourceSchema: resource,
  FieldDefinitionVersionResourceSchema: field,
  RelationDefinitionResourceSchema: relation,
  SchemaActivationResourceSchema: activation,
  BlockDefinitionVersionResourceSchema: block,
  ContentSchemaRegistryListPageSchema: {
    items: [resource, safeBlock],
    nextCursor: null,
  },
  ContentSchemaRegistryDetailSchema: detailWithPreparation,
  BlockLifecycleEventResourceSchema: lifecycleEvent,
  SchemaDryRunResourceSchema: dryRunResource,
  SchemaReviewResourceSchema: reviewResource,
  SchemaReviewDecisionResourceSchema: decisionResource,
  SchemaReviewAssignmentResourceSchema: assignmentCreated,
  CmsCapabilityGrantResourceSchema: grantResource,
  CmsCapabilityGrantListPageSchema: grantListPage,
};

export const expectedErrors = {
  'CMS-03A-01': humanMutationErrors,
  'CMS-03A-02': humanMutationErrors,
  'CMS-03A-03': humanMutationErrors,
  'CMS-03A-04': humanStepUpMutationErrors,
  // DEC-129: CMS-03A-05 creates its resource and declares no 404.
  'CMS-03A-05': blockRegistrationErrors,
  'CMS-03A-06': humanListErrors,
  'CMS-03A-07': humanDetailErrors,
  'CMS-03A-08': releaseErrors,
  'CMS-03A-09': humanMutationErrors,
  'CMS-03A-10': humanMutationErrors,
  'CMS-03A-11': humanMutationErrors,
  'CMS-03A-12': humanStepUpMutationErrors,
  'CMS-03A-13': reviewDetailErrors,
  'CMS-03A-14': humanStepUpMutationErrors,
  'CMS-03A-15': humanStepUpMutationErrors,
  'CMS-03A-16': humanStepUpMutationErrors,
  'CMS-03A-17': humanStepUpMutationErrors,
  'CMS-03A-18': humanListErrors,
} as const satisfies Readonly<
  Record<OperationId, Readonly<Record<string, number>>>
>;

const routeFor = (operationId: OperationId) => {
  const route = contentSchemaRegistryRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (route === undefined) throw new Error(`Missing route ${operationId}`);
  return route;
};

export const fixtureForRoute = (operationId: OperationId): object => {
  const route = routeFor(operationId);
  const fixture = requestFixtures[route.requestSchema];
  if (fixture === undefined)
    throw new Error(`Missing fixture ${route.requestSchema}`);
  return fixture;
};

export const schemaForRoute = (
  operationId: OperationId,
  kind: 'request' | 'success',
): ParseSchema => {
  const route = routeFor(operationId);
  const registry = kind === 'request' ? requestSchemas : successSchemas;
  const name = kind === 'request' ? route.requestSchema : route.successSchema;
  const schema = registry[name];
  if (schema === undefined) throw new Error(`Missing ${kind} schema ${name}`);
  return schema;
};
