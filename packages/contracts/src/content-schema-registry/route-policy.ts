export * from './route-policy-base.ts';

import {
  CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
  type ContentSchemaRegistryOperationId,
} from './route-policy-base.ts';
import type { RouteContractByOperation } from './route-policy-contracts.ts';

export type ContentSchemaRegistryRoutePolicy = {
  [OperationId in ContentSchemaRegistryOperationId]: Readonly<
    { operationId: OperationId } & RouteContractByOperation[OperationId]
  >;
}[ContentSchemaRegistryOperationId];

export const assertContentSchemaRegistryRouteRegistry = <
  const T extends readonly ContentSchemaRegistryRoutePolicy[],
>(
  routes: T,
): T => {
  const operationIds = new Set<ContentSchemaRegistryOperationId>();
  const methodPaths = new Set<string>();
  for (const route of routes) {
    if (operationIds.has(route.operationId))
      throw new Error(
        `Duplicate content schema registry operation: ${route.operationId}`,
      );
    operationIds.add(route.operationId);
    const methodPath = `${route.method} ${route.path}`;
    if (methodPaths.has(methodPath))
      throw new Error(`Duplicate content schema registry route: ${methodPath}`);
    methodPaths.add(methodPath);
  }
  if (routes.length !== CONTENT_SCHEMA_REGISTRY_OPERATION_IDS.length)
    throw new Error(
      `Content schema registry route count must be ${CONTENT_SCHEMA_REGISTRY_OPERATION_IDS.length}.`,
    );
  for (const operationId of CONTENT_SCHEMA_REGISTRY_OPERATION_IDS)
    if (!operationIds.has(operationId))
      throw new Error(
        `Missing content schema registry operation: ${operationId}`,
      );
  return routes;
};

/**
 * Whether the held capabilities open a route. `capabilityMode: 'any_of'`
 * needs one listed capability (CMS-03A-13: submitter/designer scope OR
 * assigned review-only scope); otherwise every listed capability is needed.
 * A route with no capability key (the owner-only CMS-03A-15 through
 * CMS-03A-18) is opened by the receipt-derived owner and never by a
 * capability, so it fails closed here.
 */
export const routeCapabilitiesSatisfied = (
  route: Readonly<{
    capability?: string;
    capabilities?: readonly string[];
    capabilityMode?: 'any_of' | 'all_of';
  }>,
  held: Iterable<string>,
): boolean => {
  const required =
    route.capabilities ??
    (route.capability === undefined ? [] : [route.capability]);
  if (required.length === 0) return false;
  const heldSet = new Set(held);
  return route.capabilityMode === 'any_of'
    ? required.some((capability) => heldSet.has(capability))
    : required.every((capability) => heldSet.has(capability));
};
