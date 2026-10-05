import type { RouteContract } from './route-policy-base.ts';
import type {
  BlockRegistrationErrors,
  HumanDetailErrors,
  HumanListErrors,
  ReleaseErrors,
} from './route-policy-errors.ts';

export type ReadReleaseRouteContractByOperation = {
  'CMS-03A-05': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/blocks/versions';
    requestSchema: 'BlockRegistrationRequestSchema';
    successSchema: 'BlockDefinitionVersionResourceSchema';
    openApiSuccessSchema: 'BlockDefinitionRegistryRecordSchema';
    successStatus: 201;
    auth: 'signed_release_worker';
    capability: 'release.block_registry.write';
    audience: 'release-worker';
    cors: 'release-worker';
    csrf: 'forbidden';
    stepUp: 'none';
    rawBodySignature: 'required';
    idempotency: 'required';
    ifMatch: 'none';
    rateClass: 'release-registry-write';
    rateLimit: 20;
    rateScope: 'release';
    errors: BlockRegistrationErrors;
  };
  'CMS-03A-06': RouteContract & {
    method: 'GET';
    path: '/api/v1/cms/content-types';
    requestSchema: 'ContentSchemaRegistryListQuerySchema';
    successSchema: 'ContentSchemaRegistryListPageSchema';
    successStatus: 200;
    auth: 'registry_reader';
    capability: 'cms.schema_registry.read';
    capabilities: readonly ['cms.schema_registry.read', 'cms.schema_designer'];
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
    errors: HumanListErrors;
  };
  'CMS-03A-07': RouteContract & {
    method: 'GET';
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}';
    requestSchema: 'ContentSchemaRegistryDetailParamsSchema';
    successSchema: 'ContentSchemaRegistryDetailSchema';
    successStatus: 200;
    auth: 'registry_reader';
    capability: 'cms.schema_registry.read';
    capabilities: readonly ['cms.schema_registry.read', 'cms.schema_designer'];
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
  'CMS-03A-08': RouteContract & {
    method: 'POST';
    path: '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle';
    requestSchema: 'BlockLifecycleAdvanceRequestSchema';
    successSchema: 'BlockLifecycleEventResourceSchema';
    openApiSuccessSchema: 'BlockLifecycleEventReceiptSchema';
    successStatus: 201;
    auth: 'signed_release_worker';
    capability: 'release.block_registry.write';
    audience: 'release-worker';
    cors: 'release-worker';
    csrf: 'forbidden';
    stepUp: 'none';
    rawBodySignature: 'required';
    idempotency: 'required';
    ifMatch: 'required';
    rateClass: 'release-registry-lifecycle';
    rateLimit: 20;
    rateScope: 'release';
    errors: ReleaseErrors;
  };
};
