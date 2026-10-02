import type { RouteContract } from './route-policy-base.ts';
import type {
  HumanListErrors,
  HumanStepUpMutationErrors,
} from './route-policy-errors.ts';

/** Owner-only step-up mutation: no capability key, receipt-derived owner. */
type OwnerGrantMutationRoute = RouteContract & {
  method: 'POST';
  auth: 'cms_owner';
  audience: 'browser';
  cors: 'cms-console';
  csrf: 'required';
  stepUp: 'required';
  rawBodySignature: 'none';
  idempotency: 'required';
  rateClass: 'cms-activation';
  rateLimit: 10;
  partyRateLimit: 20;
  rateScope: 'user';
  errors: HumanStepUpMutationErrors;
};

/** CMS-03A-15 through CMS-03A-18 (DEC-119 owner CMS capability grants). */
export type GrantRouteContractByOperation = {
  'CMS-03A-15': OwnerGrantMutationRoute & {
    path: '/api/v1/cms/capability-grants';
    requestSchema: 'CapabilityGrantRequestSchema';
    successSchema: 'CmsCapabilityGrantResourceSchema';
    successStatus: 201;
    ifMatch: 'none';
  };
  'CMS-03A-16': OwnerGrantMutationRoute & {
    path: '/api/v1/cms/capability-grants/{grantId}/renewals';
    requestSchema: 'CapabilityGrantRenewalRequestSchema';
    successSchema: 'CmsCapabilityGrantResourceSchema';
    successStatus: 200;
    ifMatch: 'required';
  };
  'CMS-03A-17': OwnerGrantMutationRoute & {
    path: '/api/v1/cms/capability-grants/{grantId}/revocations';
    requestSchema: 'CapabilityGrantRevocationRequestSchema';
    successSchema: 'CmsCapabilityGrantResourceSchema';
    successStatus: 200;
    ifMatch: 'required';
  };
  'CMS-03A-18': RouteContract & {
    method: 'GET';
    path: '/api/v1/cms/capability-grants';
    requestSchema: 'CmsCapabilityGrantListQuerySchema';
    successSchema: 'CmsCapabilityGrantListPageSchema';
    successStatus: 200;
    auth: 'cms_owner';
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
};
