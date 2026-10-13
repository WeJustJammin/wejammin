import {
  CMS_EDITORIAL_OPERATION_IDS,
  cmsEditorialCapabilitiesSatisfied,
  type CmsEditorialOperationId,
} from './route-policy-base.ts';
import type {
  CmsEditorialRouteContract,
  CmsEditorialRoutePolicy,
} from './route-policy-contract.ts';

export const assertCmsEditorialRouteRegistry = <
  const T extends readonly CmsEditorialRoutePolicy[],
>(
  routes: T,
): T => {
  const operationIds = new Set<CmsEditorialOperationId>();
  const methodPaths = new Set<string>();
  for (const route of routes) {
    if (operationIds.has(route.operationId))
      throw new Error(
        `Duplicate cms editorial operation: ${route.operationId}`,
      );
    operationIds.add(route.operationId);
    const methodPath = `${route.method} ${route.path}`;
    if (methodPaths.has(methodPath))
      throw new Error(`Duplicate cms editorial route: ${methodPath}`);
    methodPaths.add(methodPath);
  }
  if (routes.length !== CMS_EDITORIAL_OPERATION_IDS.length)
    throw new Error(
      `Cms editorial route count must be ${CMS_EDITORIAL_OPERATION_IDS.length}.`,
    );
  for (const operationId of CMS_EDITORIAL_OPERATION_IDS)
    if (!operationIds.has(operationId))
      throw new Error(`Missing cms editorial operation: ${operationId}`);
  for (const route of routes) assertRowPolicy(route);
  return routes;
};

/**
 * Cross-field policy a row must keep, so the registry stays authoritative: the
 * step-up policy and the `STEP_UP_REQUIRED` error agree (BE03b E6), a capability
 * gate names a capability, a command carries CSRF and an idempotency key, and a
 * safe read carries no mutation guard or event.
 */
const assertRowPolicy = (route: CmsEditorialRoutePolicy): void => {
  const id = route.operationId;
  if ((route.stepUp === 'required') !== 'STEP_UP_REQUIRED' in route.errors)
    throw new Error(
      `Cms editorial step-up policy and the STEP_UP_REQUIRED error disagree: ${id}`,
    );
  if (route.gate === 'capability' && route.capabilities.length === 0)
    throw new Error(
      `Cms editorial capability gate declares no capability: ${id}`,
    );
  if (
    route.method === 'POST' &&
    (route.csrf !== 'required' || route.idempotency !== 'required')
  )
    throw new Error(
      `Cms editorial command must require CSRF and an idempotency key: ${id}`,
    );
  if (
    route.method === 'GET' &&
    (route.csrf !== 'none' ||
      route.idempotency !== 'none' ||
      route.ifMatch !== 'none' ||
      route.eventType !== 'none' ||
      route.stepUp !== 'none')
  )
    throw new Error(
      `Cms editorial safe read must carry no mutation guard, step-up or event: ${id}`,
    );
};

/**
 * The Worker's coarse pre-RPC admission of a principal. A `capability` gate
 * checks the declared any-of/all-of set; an `rpc_scope` route has no coarse gate
 * because the RPC resolves the full scope (entry assignee, reviewer assignee,
 * submitter, receipt-derived owner) and answers 403 or 404 itself.
 */
export const cmsEditorialRouteAdmitsPrincipal = (
  route: Pick<
    CmsEditorialRouteContract,
    'gate' | 'capabilities' | 'capabilityMode'
  >,
  granted: readonly string[],
): boolean =>
  route.gate === 'rpc_scope' ||
  cmsEditorialCapabilitiesSatisfied(
    route.capabilities,
    route.capabilityMode,
    granted,
  );

export type { CmsEditorialRoutePolicy } from './route-policy-contract.ts';
