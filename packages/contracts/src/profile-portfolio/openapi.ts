import { z } from 'zod';

import { ApiErrorSchema } from '../api-error.ts';
import { anchorOpenApiSchemaReferences } from '../openapi-reference-normalization.ts';
import { JobStatusSchema } from '../job-status.ts';
import * as enums from './enums.ts';
import * as epkModels from './epk-models.ts';
import * as epkPdfRequests from './epk-pdf-requests.ts';
import * as epkResources from './epk-resources.ts';
import * as epkShareRequests from './epk-share-requests.ts';
import * as events from './events.ts';
import * as portfolioModels from './portfolio-models.ts';
import * as primitives from './primitives.ts';
import * as profileModels from './profile-models.ts';
import * as profileRequests from './profile-command-requests.ts';
import * as profileReadRequests from './profile-read-requests.ts';
import * as profileResources from './profile-read-resources.ts';
import * as reelResources from './reel-resources.ts';
import { activeProfilePortfolioRoutePolicies } from './active-routes.ts';
import { deferredProfilePortfolioRoutePolicies } from './deferred-routes.ts';
import type { ProfilePortfolioRoutePolicy } from './route-policy.ts';

const schemaContracts: Record<string, z.ZodTypeAny> = Object.fromEntries(
  [
    { ApiErrorSchema, JobStatusSchema },
    primitives,
    enums,
    profileModels,
    portfolioModels,
    epkModels,
    profileRequests,
    profileReadRequests,
    profileResources,
    reelResources,
    epkShareRequests,
    epkPdfRequests,
    epkResources,
    events,
  ]
    .flatMap((module) => Object.entries(module))
    .filter(([name, schema]) => name.endsWith('Schema') && schema !== undefined)
    .map(([name, schema]) => [name, schema as z.ZodTypeAny]),
);

const componentName = (schemaName: string): string =>
  schemaName.replace(/Schema$/u, '');
const schemaForName = (schemaName: string): z.ZodTypeAny => {
  const schema = schemaContracts[schemaName];
  if (!schema)
    throw new Error(
      `Profile portfolio OpenAPI schema ${schemaName} is absent.`,
    );
  return schema;
};

export const getProfilePortfolioOpenApiSchemaJson = (
  schemaName: string,
): unknown =>
  anchorOpenApiSchemaReferences(
    componentName(schemaName),
    z.toJSONSchema(schemaForName(schemaName), {
      io: 'input',
      target: 'draft-7',
      unrepresentable: 'any',
    }),
  );

export const getProfilePortfolioOpenApiComponentSchemas = (): Readonly<
  Record<string, unknown>
> =>
  Object.fromEntries(
    Object.keys(schemaContracts).map((name) => [
      componentName(name),
      getProfilePortfolioOpenApiSchemaJson(name),
    ]),
  );

export const getProfilePortfolioOpenApiSchemaReference = (
  schemaName: string,
): Readonly<{ $ref: string }> => {
  schemaForName(schemaName);
  return { $ref: `#/components/schemas/${componentName(schemaName)}` };
};

const pathParameters = (path: string): ReadonlyArray<Record<string, unknown>> =>
  [...path.matchAll(/\{([^}]+)\}/gu)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

const operation = (
  route: ProfilePortfolioRoutePolicy,
): Record<string, unknown> => {
  const requestRef = getProfilePortfolioOpenApiSchemaReference(
    route.requestSchema,
  );
  const responseRef = getProfilePortfolioOpenApiSchemaReference(
    route.successSchema,
  );
  const status =
    route.operationId === 'PRF-PROF-07'
      ? '201'
      : route.operationId === 'PRF-PROF-10'
        ? '202'
        : '200';
  const result: Record<string, unknown> = {
    operationId: route.operationId,
    tags: ['profile-portfolio'],
    parameters: pathParameters(route.path),
    responses: {
      [status]: {
        description: 'Success',
        content: { 'application/json': { schema: responseRef } },
      },
    },
    'x-auth': route.auth,
    'x-cache-control': route.cacheControl,
    'x-rate-limit': {
      limit: route.rateLimit,
      windowSeconds: route.rateWindowSeconds,
      scope: route.rateScope,
    },
    'x-request-schema': requestRef,
  };
  if (route.method !== 'GET')
    result.requestBody = {
      required: true,
      content: { 'application/json': { schema: requestRef } },
    };
  return result;
};

const pathsFor = (routes: readonly ProfilePortfolioRoutePolicy[]) => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const pathItem = paths[route.path] ?? {};
    pathItem[route.method.toLowerCase()] = operation(route);
    paths[route.path] = pathItem;
  }
  return paths;
};

export const profilePortfolioOpenApiPaths = pathsFor(
  activeProfilePortfolioRoutePolicies,
);
export const profilePortfolioDeferredOpenApiPaths = pathsFor(
  deferredProfilePortfolioRoutePolicies,
);

export const buildProfilePortfolioOpenApiDocument = (
  options: { includeDeferred?: boolean } = {},
) => ({
  openapi: '3.1.0',
  info: { title: 'WeJammin Profile Portfolio API', version: '1.0.0' },
  paths: options.includeDeferred
    ? {
        ...profilePortfolioOpenApiPaths,
        ...profilePortfolioDeferredOpenApiPaths,
      }
    : profilePortfolioOpenApiPaths,
  components: { schemas: getProfilePortfolioOpenApiComponentSchemas() },
});
