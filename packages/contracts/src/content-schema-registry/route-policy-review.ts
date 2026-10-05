import type { RouteContract } from './route-policy-base.ts';
import type {
  HumanDetailErrors,
  HumanMutationErrors,
  HumanStepUpMutationErrors,
} from './route-policy-errors.ts';

type DesignerWriteRoute = RouteContract & {
  method: 'POST';
  auth: 'schema_designer';
  capability: 'cms.schema_designer';
  audience: 'browser';
  cors: 'cms-console';
  csrf: 'required';
  stepUp: 'none';
  rawBodySignature: 'none';
  idempotency: 'required';
  ifMatch: 'required';
  rateClass: 'cms-definition-write';
  rateLimit: 30;
  partyRateLimit: 60;
  rateScope: 'user';
  errors: HumanMutationErrors;
};

/** CMS-03A-09 through CMS-03A-14 (DEC-108 activation producers). */
export type ReviewRouteContractByOperation = {
  'CMS-03A-09': DesignerWriteRoute & {
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors';
    requestSchema: 'SchemaSuccessorRequestSchema';
    successSchema: 'ContentTypeVersionResourceSchema';
    successStatus: 201;
  };
  'CMS-03A-10': DesignerWriteRoute & {
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs';
    requestSchema: 'SchemaDryRunRequestSchema';
    successSchema: 'SchemaDryRunResourceSchema';
    successStatus: 202;
  };
  'CMS-03A-11': DesignerWriteRoute & {
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews';
    requestSchema: 'SchemaReviewSubmissionRequestSchema';
    successSchema: 'SchemaReviewResourceSchema';
    successStatus: 201;
  };
  'CMS-03A-12': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/schema-reviews/{reviewId}/decisions';
    requestSchema: 'SchemaReviewDecisionRequestSchema';
    successSchema: 'SchemaReviewDecisionResourceSchema';
    successStatus: 201;
    auth: 'schema_reviewer';
    capability: 'cms.schema_review';
    audience: 'browser';
    cors: 'cms-console';
    csrf: 'required';
    stepUp: 'required';
    rawBodySignature: 'none';
    idempotency: 'required';
    ifMatch: 'required';
    rateClass: 'cms-activation';
    rateLimit: 30;
    partyRateLimit: 60;
    rateScope: 'user';
    errors: HumanStepUpMutationErrors;
  };
  'CMS-03A-13': RouteContract & {
    method: 'GET';
    path: '/api/v1/cms/schema-reviews/{reviewId}';
    requestSchema: 'SchemaReviewDetailParamsSchema';
    successSchema: 'SchemaReviewResourceSchema';
    successStatus: 200;
    auth: 'review_reader';
    capability: 'cms.schema_designer';
    capabilities: readonly ['cms.schema_designer', 'cms.schema_review'];
    /** Submitter/designer scope OR assigned review-only scope. */
    capabilityMode: 'any_of';
    audience: 'browser';
    cors: 'cms-console';
    csrf: 'none';
    stepUp: 'none';
    rawBodySignature: 'none';
    idempotency: 'none';
    ifMatch: 'none';
    rateClass: 'cms-definition-read';
    rateLimit: 120;
    partyRateLimit: 240;
    rateScope: 'user';
    errors: HumanDetailErrors;
  };
  'CMS-03A-14': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/schema-reviews/{reviewId}/assignments';
    requestSchema: 'SchemaReviewAssignmentRequestSchema';
    successSchema: 'SchemaReviewAssignmentResourceSchema';
    successStatus: 201;
    successStatuses: readonly [200, 201];
    auth: 'review_assigner';
    capability: 'cms.schema_review.assign';
    audience: 'browser';
    cors: 'cms-console';
    csrf: 'required';
    stepUp: 'required';
    rawBodySignature: 'none';
    idempotency: 'required';
    ifMatch: 'required';
    rateClass: 'cms-activation';
    rateLimit: 10;
    partyRateLimit: 20;
    rateScope: 'user';
    errors: HumanStepUpMutationErrors;
  };
};
