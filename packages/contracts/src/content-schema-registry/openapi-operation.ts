import { z } from 'zod';

import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import {
  apiErrorResponses,
  capabilityGrantListQueryParameters,
  listQueryParameters,
  mutationHeaderParameters,
  pathParameters,
  schemaContracts,
  schemaReference,
} from './openapi-support.ts';

export const operation = (
  route: ContentSchemaRegistryRoutePolicy,
  contracts: Readonly<Record<string, z.ZodTypeAny>> = schemaContracts,
): Record<string, unknown> => {
  const requestRef = schemaReference(route.requestSchema, contracts);
  const responseRef = schemaReference(
    route.openApiSuccessSchema ?? route.successSchema,
    contracts,
  );
  const successStatuses = route.successStatuses ?? [route.successStatus];
  const responses: Record<string, unknown> = Object.fromEntries(
    successStatuses.map((status) => [
      String(status),
      {
        description: 'Success',
        content: { 'application/json': { schema: responseRef } },
      },
    ]),
  );
  Object.assign(responses, apiErrorResponses(route, contracts));
  const parameters = [
    ...pathParameters(route.path),
    ...(route.requestSchema === 'ContentSchemaRegistryListQuerySchema'
      ? listQueryParameters(contracts)
      : []),
    ...(route.requestSchema === 'CmsCapabilityGrantListQuerySchema'
      ? capabilityGrantListQueryParameters(contracts)
      : []),
    ...(route.method === 'POST' ? mutationHeaderParameters(route) : []),
  ];
  const result: Record<string, unknown> = {
    operationId: route.operationId,
    tags: ['content-schema-registry'],
    parameters,
    responses,
    'x-audience': route.audience,
    'x-auth': route.auth,
    ...(route.capability === undefined
      ? {}
      : { 'x-capability': route.capability }),
    ...(route.capabilities === undefined && route.capability === undefined
      ? {}
      : { 'x-capabilities': route.capabilities ?? [route.capability] }),
    ...(route.capabilityMode === undefined
      ? {}
      : { 'x-capability-mode': route.capabilityMode }),
    'x-cors': route.cors,
    'x-cache-control': route.cacheControl,
    'x-timeout-ms': route.timeoutMs,
    'x-slo': route.slo,
    'x-csrf': route.csrf,
    'x-step-up': route.stepUp,
    'x-idempotency': route.idempotency,
    'x-if-match': route.ifMatch,
    'x-raw-body-signature': route.rawBodySignature,
    'x-rate-limit': {
      class: route.rateClass,
      limit: route.rateLimit,
      partyLimit: route.partyRateLimit,
      windowSeconds: route.rateWindowSeconds,
      scope: route.rateScope,
    },
    'x-request-schema': requestRef,
  };
  if (route.method !== 'GET') {
    result.requestBody = {
      required: true,
      content: { 'application/json': { schema: requestRef } },
    };
  }
  return result;
};

export const buildPaths = (
  routes: readonly ContentSchemaRegistryRoutePolicy[],
  contracts: Readonly<Record<string, z.ZodTypeAny>>,
): Readonly<Record<string, Record<string, unknown>>> => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const pathItem = paths[route.path] ?? {};
    const method = route.method.toLowerCase();
    if (method in pathItem)
      throw new Error(
        `Duplicate content schema registry OpenAPI route: ${route.method} ${route.path}`,
      );
    pathItem[method] = operation(route, contracts);
    paths[route.path] = pathItem;
  }
  return paths;
};
