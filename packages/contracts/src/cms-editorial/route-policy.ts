import {
  CMS_EDITORIAL_OPERATION_IDS,
  type CmsEditorialOperationId,
} from './route-policy-base.ts';
import type { CmsEditorialRoutePolicy } from './route-policy-contract.ts';

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
  return routes;
};

export type { CmsEditorialRoutePolicy } from './route-policy-contract.ts';
