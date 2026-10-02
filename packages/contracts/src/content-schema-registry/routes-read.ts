import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import {
  humanDetailErrors,
  humanListErrors,
  tier2Slo,
} from './routes-errors.ts';

const readDefaults = {
  method: 'GET',
  auth: 'registry_reader',
  capability: 'cms.schema_registry.read',
  capabilities: ['cms.schema_registry.read', 'cms.schema_designer'],
  audience: 'browser',
  cors: 'cms-console',
  csrf: 'none',
  stepUp: 'none',
  rawBodySignature: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  rateClass: 'cms-definition-read',
  rateLimit: 120,
  partyRateLimit: 240,
  rateWindowSeconds: 60,
  rateScope: 'user',
  timeoutMs: 15_000,
  cacheControl: 'no-store',
  slo: tier2Slo,
} as const;

export const readRoutePolicies = [
  {
    ...readDefaults,
    operationId: 'CMS-03A-06',
    path: '/api/v1/cms/content-types',
    requestSchema: 'ContentSchemaRegistryListQuerySchema',
    successSchema: 'ContentSchemaRegistryListPageSchema',
    successStatus: 200,
    errors: humanListErrors,
  },
  {
    ...readDefaults,
    operationId: 'CMS-03A-07',
    path: '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}',
    requestSchema: 'ContentSchemaRegistryDetailParamsSchema',
    successSchema: 'ContentSchemaRegistryDetailSchema',
    successStatus: 200,
    errors: humanDetailErrors,
  },
] as const satisfies readonly ContentSchemaRegistryRoutePolicy[];
