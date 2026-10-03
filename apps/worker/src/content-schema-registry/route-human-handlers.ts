import type {
  CmsCapabilityGrantListQuery,
  ContentSchemaRegistryListQuery,
} from './contracts';
import {
  decodeJsonBody,
  humanBodySchemas,
  jsonBodyPreflight,
  parseMutationHeaders,
  readBytes,
  rejectReadMutationHeadersOrBody,
  type ParsedHumanBody,
} from './admission';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
  HumanMutationOperationId,
  HumanReadOperationId,
} from './types';
import type { FeatureContext } from './route-types';
import { invalid } from './admission-common';
import { successorDeferredToDatabase } from './admission-successor';
import { errorResponse } from './route-response';
import { createHumanAuthority } from './route-human-authority';
import type { RouteExecutor } from './route-execution';

type PathResult = ContentSchemaRegistryResult<Readonly<Record<string, string>>>;

/** BE00 step 6 for a read: strict path and query, resolved lazily. */
export type ReadInput = ContentSchemaRegistryResult<
  Readonly<{
    path: Readonly<Record<string, string>>;
    query?: ContentSchemaRegistryListQuery | CmsCapabilityGrantListQuery;
  }>
>;

export type HumanMutation = (
  context: FeatureContext,
  operationId: HumanMutationOperationId,
  bodySchema: (typeof humanBodySchemas)[HumanMutationOperationId],
  parsePath?: (context: FeatureContext) => PathResult,
) => Promise<Response>;

export type ProtectedRead = (
  context: FeatureContext,
  operationId: HumanReadOperationId,
  validate: (context: FeatureContext) => ReadInput,
) => Promise<Response>;

/**
 * Both handlers follow BE00 "Hono Middleware Order" exactly: route and request
 * context (the route guard), security/transport (origin, size, content type,
 * CSRF), authentication, acting context, strict boundary validation,
 * authorization (capability, step-up, quota), then the idempotency headers.
 */
export const createHumanHandlers = (
  dependencies: ContentSchemaRegistryDependencies,
  execute: RouteExecutor,
): Readonly<{ humanMutation: HumanMutation; protectedRead: ProtectedRead }> => {
  const gates = createHumanAuthority(dependencies);

  const humanMutation: HumanMutation = async (
    context,
    operationId,
    bodySchema,
    parsePath,
  ): Promise<Response> => {
    const requestId = context.get('requestId');
    const refuse = (error: ContentSchemaRegistryError): Response =>
      errorResponse(context, error, requestId);
    // Step 2: CORS origin, body size ceiling, content type, then CSRF.
    const origin = gates.origin(context);
    if (origin !== null) return origin;
    const preflight = jsonBodyPreflight(context.req.raw);
    if (preflight !== null) return refuse(preflight);
    const csrf = gates.csrf(context);
    if (csrf !== null) return csrf;
    const bytes = await readBytes(context.req.raw);
    if (!bytes.ok) return refuse(bytes);
    // Steps 4 and 5: verified session, then the acting context.
    const authentication = await gates.authenticate(context);
    if (!authentication.ok) return authentication.response;
    const { session } = authentication;
    // Step 6: strict path, then strict body (CMS-03A-10: a caller-supplied
    // count, hash, classification or report is an unknown key and a
    // structural 400, BE03a error matrix, AC356).
    const path = parsePath === undefined ? null : parsePath(context);
    if (path !== null && !path.ok) return refuse(path);
    const body = decodeJsonBody<ParsedHumanBody>(bytes.value, bodySchema, {
      unknownKeyIsStructural: operationId === 'CMS-03A-10',
      ...(operationId === 'CMS-03A-09'
        ? { deferredToDatabase: successorDeferredToDatabase }
        : {}),
    });
    if (!body.ok) return refuse(body);
    // Step 7: capability, step-up freshness, quota.
    const denied = await gates.authorize(context, operationId, session);
    if (denied !== null) return denied;
    // Step 8: exact Idempotency-Key and quoted If-Match.
    const headers = parseMutationHeaders(context.req.raw, operationId);
    if (!headers.ok) return refuse(headers);
    // The body expectedVersion and the strong If-Match name one version; a
    // disagreement is a malformed request, never silently resolved.
    const bodyVersion = (body.value as { expectedVersion?: unknown })
      .expectedVersion;
    if (
      typeof bodyVersion === 'string' &&
      headers.value.ifMatch !== undefined &&
      bodyVersion !== headers.value.ifMatch
    )
      return refuse(
        invalid('expectedVersion must equal the If-Match version.'),
      );
    return execute(context, operationId, 'human', {
      operationId,
      requestId,
      request: context.req.raw,
      session,
      path: path === null ? {} : path.value,
      body: body.value as NonNullable<ContentSchemaRegistryPortInput['body']>,
      idempotencyKey: headers.value.idempotencyKey,
      ...(headers.value.ifMatch === undefined
        ? {}
        : { ifMatch: headers.value.ifMatch }),
    });
  };

  const protectedRead: ProtectedRead = async (
    context,
    operationId,
    validate,
  ): Promise<Response> => {
    const requestId = context.get('requestId');
    const origin = gates.origin(context);
    if (origin !== null) return origin;
    const authentication = await gates.authenticate(context);
    if (!authentication.ok) return authentication.response;
    const { session } = authentication;
    // Step 6: no mutation headers or body, strict path and query.
    const readHeaders = await rejectReadMutationHeadersOrBody(context.req.raw);
    if (readHeaders !== null)
      return errorResponse(context, readHeaders, requestId);
    const input = validate(context);
    if (!input.ok) return errorResponse(context, input, requestId);
    const denied = await gates.authorize(context, operationId, session);
    if (denied !== null) return denied;
    return execute(context, operationId, 'human', {
      operationId,
      requestId,
      request: context.req.raw,
      session,
      path: input.value.path,
      ...(input.value.query === undefined ? {} : { query: input.value.query }),
    });
  };

  return { humanMutation, protectedRead };
};
