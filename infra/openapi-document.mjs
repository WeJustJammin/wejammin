import {
  contentSchemaRegistryOpenApiPaths,
  getContentSchemaRegistryOpenApiComponentSchemas,
  getOpenApiComponentSchemas,
  getOpenApiSchemaJson,
  getOpenApiSchemaReference,
  platformRegistrySet,
} from '../packages/contracts/src/index.ts';
import {
  EMPTY_REQUEST_SCHEMA,
  entityHeaders,
  mutationHeaders,
  retryHeaders,
  routeDefinitions,
} from './openapi-definitions.mjs';

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pathParameterNames = (path) =>
  [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);

const wireHeaderNames = {
  idempotencyKey: 'Idempotency-Key',
  ifMatch: 'If-Match',
  xCsrfToken: 'X-CSRF-Token',
};

const contentSchemaRegistryOperationIds = new Set([
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
  'CMS-03A-09',
  'CMS-03A-10',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-13',
  'CMS-03A-14',
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
  'CMS-03A-18',
]);

const contentSchemaRegistryComponentSchemas =
  getContentSchemaRegistryOpenApiComponentSchemas();
const componentName = (schemaName) =>
  schemaName.endsWith('Schema')
    ? schemaName.slice(0, -'Schema'.length)
    : schemaName;
const schemaReference = (schemaName) => {
  if (
    Object.hasOwn(
      contentSchemaRegistryComponentSchemas,
      componentName(schemaName),
    )
  )
    return { $ref: `#/components/schemas/${componentName(schemaName)}` };
  return getOpenApiSchemaReference(schemaName);
};

const requiredPropertyNames = (schema) =>
  Array.isArray(schema.required) ? schema.required : [];

const requiredObjectProperty = (schema, property, schemaName) => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const nested = properties[property];
  if (!isRecord(nested) || !requiredPropertyNames(schema).includes(property)) {
    throw new Error(
      `Request schema ${schemaName} must require object property ${property}.`,
    );
  }
  return nested;
};

const headerParameters = (headers, schemaName) => {
  if (!isRecord(headers.properties)) {
    throw new Error(
      `Request schema ${schemaName} headers must expose an object property map.`,
    );
  }
  const required = requiredPropertyNames(headers);
  return Object.entries(headers.properties).flatMap(([property, schema]) => {
    const name = wireHeaderNames[property];
    if (!name) return [];
    if (!isRecord(schema)) {
      throw new Error(
        `Request schema ${schemaName} header ${property} must be a schema.`,
      );
    }
    return [
      { name, in: 'header', required: required.includes(property), schema },
    ];
  });
};

const contentSchemaRegistryRequestShape = (registry) => {
  if (!contentSchemaRegistryOperationIds.has(registry.operationId))
    return undefined;
  const pathItem = contentSchemaRegistryOpenApiPaths[registry.path];
  const contentOperation = pathItem?.[registry.method.toLowerCase()];
  if (!isRecord(contentOperation)) {
    throw new Error(
      `Content schema registry OpenAPI operation ${registry.operationId} has no matching path declaration.`,
    );
  }
  return {
    ...(Array.isArray(contentOperation.parameters)
      ? { parameters: contentOperation.parameters }
      : {}),
    ...(isRecord(contentOperation.requestBody)
      ? { requestBody: contentOperation.requestBody }
      : {}),
  };
};

const requestShape = (registry) => {
  const contentRequest = contentSchemaRegistryRequestShape(registry);
  if (contentRequest) return contentRequest;

  const names = pathParameterNames(registry.path);
  if (registry.requestSchema === EMPTY_REQUEST_SCHEMA) {
    if (names.length === 0) return {};
    throw new Error(
      `Route ${registry.operationId} declares path parameters but no request schema.`,
    );
  }

  const requestSchema = getOpenApiSchemaJson(registry.requestSchema);
  if (!isRecord(requestSchema) || !isRecord(requestSchema.properties)) {
    throw new Error(
      `Request schema ${registry.requestSchema} must expose an object property map for ${registry.operationId}.`,
    );
  }

  const required = requiredPropertyNames(requestSchema);
  const declaredProperties = Object.keys(requestSchema.properties);
  const isStructuredRequest = declaredProperties.some((name) =>
    ['body', 'headers', 'query'].includes(name),
  );
  if (!isStructuredRequest && names.length === 0) {
    return {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: getOpenApiSchemaReference(registry.requestSchema),
          },
        },
      },
    };
  }

  if (
    declaredProperties.some(
      (name) =>
        !names.includes(name) && !['body', 'headers', 'query'].includes(name),
    )
  ) {
    throw new Error(
      `Request schema ${registry.requestSchema} declares a property absent from ${registry.path}.`,
    );
  }

  const parameters = names.map((name) => {
    const schema = requestSchema.properties[name];
    if (!isRecord(schema) || !required.includes(name)) {
      throw new Error(
        `Request schema ${registry.requestSchema} must require path parameter ${name}.`,
      );
    }
    return {
      name,
      in: 'path',
      required: true,
      schema,
    };
  });
  if (declaredProperties.includes('headers')) {
    parameters.push(
      ...headerParameters(
        requiredObjectProperty(
          requestSchema,
          'headers',
          registry.requestSchema,
        ),
        registry.requestSchema,
      ),
    );
  }
  if (declaredProperties.includes('query')) {
    const query = requiredObjectProperty(
      requestSchema,
      'query',
      registry.requestSchema,
    );
    const queryRequired = requiredPropertyNames(query);
    if (!isRecord(query.properties)) {
      throw new Error(
        `Request schema ${registry.requestSchema} query must expose an object property map.`,
      );
    }
    parameters.push(
      ...Object.entries(query.properties).map(([name, schema]) => ({
        name,
        in: 'query',
        required: queryRequired.includes(name),
        schema,
      })),
    );
  }

  const body = declaredProperties.includes('body')
    ? requiredObjectProperty(requestSchema, 'body', registry.requestSchema)
    : undefined;
  return {
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: body } },
          },
        }
      : {}),
  };
};

const responseHeaders = (kind) => {
  if (kind === 'entity') return entityHeaders;
  if (kind === 'mutation') return mutationHeaders;
  if (kind === 'rate') return retryHeaders;
  return undefined;
};

const errorSchema = (registry) => {
  const references = registry.errorSchemas.map(schemaReference);
  return references.length === 1 ? references[0] : { oneOf: references };
};

/**
 * A step-up 401 publishes the exact unauthenticated/step-up union so clients
 * can tell an expired session (`reauthenticate`) from recoverable MFA
 * (`step_up` plus `allowedMethods`).
 */
const stepUpUnauthorizedSchema = () => ({
  oneOf: [
    schemaReference('CmsUnauthenticatedErrorSchema'),
    schemaReference('CmsStepUpRequiredErrorSchema'),
  ],
});

const responseContent = (schema) => ({
  'application/json': { schema },
});

const operation = (registry, definition) => {
  const request = requestShape(registry);
  const successSchema = registry.openApiSuccessSchema ?? registry.successSchema;
  const successReference = schemaReference(successSchema);
  const errorReference = errorSchema(registry);
  const responses = Object.fromEntries(
    definition.responses.map((response) => {
      const schema =
        response.schema === 'success'
          ? successReference
          : response.schema === 'error'
            ? errorReference
            : response.schema === 'stepUpUnauthorized'
              ? stepUpUnauthorizedSchema()
              : undefined;
      const headers = responseHeaders(response.headers);
      return [
        response.status,
        {
          description: response.description,
          ...(headers ? { headers } : {}),
          ...(schema ? { content: responseContent(schema) } : {}),
        },
      ];
    }),
  );

  return {
    operationId: registry.operationId,
    deprecated: registry.deprecated,
    'x-auth-class': registry.authClass,
    ...(registry.capability ? { 'x-capability': registry.capability } : {}),
    ...(registry.capabilities
      ? { 'x-capabilities': registry.capabilities }
      : {}),
    ...(registry.capabilityMode
      ? { 'x-capability-mode': registry.capabilityMode }
      : {}),
    ...(registry.stepUp ? { 'x-step-up': registry.stepUp } : {}),
    ...(registry.corsClass ? { 'x-cors': registry.corsClass } : {}),
    ...(registry.audience ? { 'x-audience': registry.audience } : {}),
    'x-cache-class': registry.cacheClass,
    ...(registry.cacheControl
      ? { 'x-cache-control': registry.cacheControl }
      : {}),
    'x-timeout-ms': registry.timeoutMs,
    'x-rate-class': registry.rateClass,
    ...(registry.rateLimit !== undefined
      ? {
          'x-rate-limit': {
            class: registry.rateClass,
            limit: registry.rateLimit,
            ...(registry.partyRateLimit !== undefined
              ? { partyLimit: registry.partyRateLimit }
              : {}),
            ...(registry.rateWindowSeconds !== undefined
              ? { windowSeconds: registry.rateWindowSeconds }
              : {}),
            ...(registry.rateScope ? { scope: registry.rateScope } : {}),
          },
        }
      : {}),
    'x-slo-tier': registry.sloTier,
    ...(registry.slo ? { 'x-slo': registry.slo } : {}),
    ...(registry.csrf ? { 'x-csrf': registry.csrf } : {}),
    ...(registry.idempotency ? { 'x-idempotency': registry.idempotency } : {}),
    ...(registry.ifMatch ? { 'x-if-match': registry.ifMatch } : {}),
    ...(registry.rawBodySignature
      ? { 'x-raw-body-signature': registry.rawBodySignature }
      : {}),
    'x-criticality': registry.criticality,
    'x-owner': registry.owner,
    'x-runbook': registry.runbook,
    'x-request-schema': registry.requestSchema,
    'x-success-schema': successSchema,
    'x-error-schemas': registry.errorSchemas,
    'x-bola-test': registry.bolaTest,
    ...(request.parameters ? { parameters: request.parameters } : {}),
    ...(request.requestBody ? { requestBody: request.requestBody } : {}),
    responses,
  };
};

const assertCanonicalJobSurface = (routes) => {
  const jobRoutes = routes.filter(
    ({ path }) => path === '/api/v1/jobs' || path.startsWith('/api/v1/jobs/'),
  );
  const canonical = jobRoutes[0];
  if (
    jobRoutes.length !== 1 ||
    canonical?.method !== 'GET' ||
    canonical.path !== '/api/v1/jobs/{jobId}' ||
    canonical.operationId !== 'jobStatusRead'
  ) {
    throw new Error(
      'The public job surface must contain only GET /api/v1/jobs/{jobId}.',
    );
  }
};

export const buildOpenApiDocument = (registrySet = platformRegistrySet) => {
  assertCanonicalJobSurface(registrySet.routes);
  const paths = {};
  const seenOperations = new Set();

  for (const registry of registrySet.routes) {
    const definition = routeDefinitions[registry.operationId];
    if (!definition) {
      throw new Error(
        `OpenAPI operation ${registry.operationId} has no response definition.`,
      );
    }
    if (seenOperations.has(registry.operationId)) {
      throw new Error(`Duplicate OpenAPI operation ${registry.operationId}.`);
    }
    seenOperations.add(registry.operationId);

    const method = registry.method.toLowerCase();
    const pathItem = paths[registry.path] ?? {};
    if (pathItem[method]) {
      throw new Error(
        `Duplicate OpenAPI method/path ${registry.method} ${registry.path}.`,
      );
    }
    pathItem[method] = operation(registry, definition);
    paths[registry.path] = pathItem;
  }

  for (const operationId of Object.keys(routeDefinitions)) {
    if (!seenOperations.has(operationId)) {
      throw new Error(
        `OpenAPI response definition ${operationId} is absent from the route registry.`,
      );
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: 'WeJammin API', version: 'v1' },
    paths,
    components: {
      schemas: {
        ...getOpenApiComponentSchemas(),
        ...contentSchemaRegistryComponentSchemas,
      },
    },
  };
};
