import type { RouteContract } from './route-policy-base.ts';
import type {
  HumanMutationErrors,
  HumanStepUpMutationErrors,
} from './route-policy-errors.ts';

export type HumanRouteContractByOperation = {
  'CMS-03A-01': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/content-types';
    requestSchema: 'ContentTypeDraftRequestSchema';
    successSchema: 'ContentTypeVersionResourceSchema';
    successStatus: 201;
    auth: 'schema_designer';
    capability: 'cms.schema_designer';
    audience: 'browser';
    cors: 'cms-console';
    csrf: 'required';
    stepUp: 'none';
    rawBodySignature: 'none';
    idempotency: 'required';
    ifMatch: 'none';
    rateClass: 'cms-definition-write';
    rateLimit: 30;
    partyRateLimit: 60;
    rateScope: 'user';
    errors: HumanMutationErrors;
  };
  'CMS-03A-02': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields';
    requestSchema: 'FieldSchemaChangeRequestSchema';
    successSchema: 'FieldDefinitionVersionResourceSchema';
    successStatus: 201;
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
    rateLimit: 60;
    partyRateLimit: 120;
    rateScope: 'user';
    errors: HumanMutationErrors;
  };
  'CMS-03A-03': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations';
    requestSchema: 'RelationBindingRequestSchema';
    successSchema: 'RelationDefinitionResourceSchema';
    successStatus: 201;
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
    rateLimit: 60;
    partyRateLimit: 120;
    rateScope: 'user';
    errors: HumanMutationErrors;
  };
  'CMS-03A-04': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate';
    requestSchema: 'SchemaActivationRequestSchema';
    successSchema: 'SchemaActivationResourceSchema';
    successStatus: 202;
    successStatuses: readonly [200, 202];
    auth: 'schema_designer';
    capability: 'cms.schema_designer';
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
