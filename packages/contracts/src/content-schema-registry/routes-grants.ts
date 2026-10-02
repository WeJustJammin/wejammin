import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import {
  humanListErrors,
  humanStepUpMutationErrors,
  tier2Slo,
} from './routes-errors.ts';

const browserDefaults = {
  audience: 'browser',
  auth: 'cms_owner',
  cors: 'cms-console',
  rawBodySignature: 'none',
  rateWindowSeconds: 60,
  rateScope: 'user',
  timeoutMs: 15_000,
  cacheControl: 'no-store',
  slo: tier2Slo,
} as const;

const ownerMutationDefaults = {
  ...browserDefaults,
  method: 'POST',
  successSchema: 'CmsCapabilityGrantResourceSchema',
  csrf: 'required',
  stepUp: 'required',
  idempotency: 'required',
  rateClass: 'cms-activation',
  rateLimit: 10,
  partyRateLimit: 20,
  errors: humanStepUpMutationErrors,
} as const;

const grantsPath = '/api/v1/cms/capability-grants';

/**
 * CMS-03A-15 through CMS-03A-18, per the BE03a Route Registry. The owner is
 * derived from the immutable owner initialization receipt, so no route
 * carries a capability key.
 */
export const grantRoutePolicies = [
  {
    ...ownerMutationDefaults,
    operationId: 'CMS-03A-15',
    path: grantsPath,
    requestSchema: 'CapabilityGrantRequestSchema',
    successStatus: 201,
    ifMatch: 'none',
  },
  {
    ...ownerMutationDefaults,
    operationId: 'CMS-03A-16',
    path: `${grantsPath}/{grantId}/renewals`,
    requestSchema: 'CapabilityGrantRenewalRequestSchema',
    successStatus: 200,
    ifMatch: 'required',
  },
  {
    ...ownerMutationDefaults,
    operationId: 'CMS-03A-17',
    path: `${grantsPath}/{grantId}/revocations`,
    requestSchema: 'CapabilityGrantRevocationRequestSchema',
    successStatus: 200,
    ifMatch: 'required',
  },
  {
    ...browserDefaults,
    operationId: 'CMS-03A-18',
    method: 'GET',
    path: grantsPath,
    requestSchema: 'CmsCapabilityGrantListQuerySchema',
    successSchema: 'CmsCapabilityGrantListPageSchema',
    successStatus: 200,
    csrf: 'none',
    stepUp: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-definition-read',
    rateLimit: 120,
    partyRateLimit: 240,
    errors: humanListErrors,
  },
] as const satisfies readonly ContentSchemaRegistryRoutePolicy[];
