import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import { releaseErrors, tier2Slo } from './routes-errors.ts';

const releaseDefaults = {
  method: 'POST',
  auth: 'signed_release_worker',
  capability: 'release.block_registry.write',
  cors: 'release-worker',
  csrf: 'forbidden',
  stepUp: 'none',
  rawBodySignature: 'required',
  idempotency: 'required',
  rateClass: 'release-registry-write',
  rateLimit: 20,
  rateWindowSeconds: 60,
  rateScope: 'release',
  timeoutMs: 15_000,
  cacheControl: 'no-store',
  slo: tier2Slo,
  audience: 'release-worker',
  errors: releaseErrors,
} as const;

export const releaseRoutePolicies = [
  {
    ...releaseDefaults,
    operationId: 'CMS-03A-05',
    path: '/api/v1/cms/blocks/versions',
    requestSchema: 'BlockRegistrationRequestSchema',
    successSchema: 'BlockDefinitionVersionResourceSchema',
    openApiSuccessSchema: 'BlockDefinitionRegistryRecordSchema',
    successStatus: 201,
    ifMatch: 'none',
  },
  {
    ...releaseDefaults,
    operationId: 'CMS-03A-08',
    path: '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle',
    requestSchema: 'BlockLifecycleAdvanceRequestSchema',
    successSchema: 'BlockLifecycleEventResourceSchema',
    openApiSuccessSchema: 'BlockLifecycleEventReceiptSchema',
    successStatus: 201,
    ifMatch: 'required',
    rateClass: 'release-registry-lifecycle',
  },
] as const satisfies readonly ContentSchemaRegistryRoutePolicy[];
