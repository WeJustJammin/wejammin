import {
  AddFacetRequestSchema,
  CreatePersonRequestSchema,
  FacetMutationResponseSchema,
  IdentityFacetPathSchema,
  IdentityStrictEmptySchema,
  PersonIdentityResponseSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  admitJsonMutationTransport,
  responseForAuthError,
} from '../authentication/boundary';
import {
  configureIdentityRoute,
  identityError,
  parseIdentityCommandHeaders,
  decodeIdentityBody,
} from './route-support';
import { execute, pathError, rate, resolve } from './handler-support';
import type { RecoveryState } from './recovery';

export const createPerson = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-01');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // BE00 step 6: strict body.
  const body = decodeIdentityBody(transport.value, CreatePersonRequestSchema);
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await rate(context, dependencies, 'BE01b-01', resolved.value);
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseIdentityCommandHeaders(context.req.raw, false);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    request: context.req.raw,
    session: resolved.value,
    idempotencyKey: headers.value.idempotencyKey,
  };
  const port = dependencies.identityAuthority?.createPerson;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-01',
    { ...input, ifMatch: null, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    PersonIdentityResponseSchema,
    201,
  );
};

export const readPerson = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-02');
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // BE00 step 6: strict path and query.
  const query = parseIdentityReadQuery(context.req.raw);
  if (!query.ok) return responseForAuthError(context, query);
  const limited = await rate(context, dependencies, 'BE01b-02', resolved.value);
  if (limited !== null) return limited;
  const input = { request: context.req.raw, session: resolved.value };
  const port = dependencies.identityAuthority?.readPerson;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-02',
    {
      session: resolved.value,
      idempotencyKey: '',
      ifMatch: null,
      mutation: false,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    PersonIdentityResponseSchema,
    200,
  );
};

const parseIdentityReadQuery = (request: Request) => {
  const params = new URL(request.url).searchParams;
  if (params.size > 0)
    return identityError(
      400,
      'INVALID_REQUEST',
      'Query parameters are invalid.',
      {
        violations: [
          {
            path: '/query',
            code: 'unknown_field',
            message: 'The value is invalid.',
          },
        ],
      },
    );
  return { ok: true as const, value: null };
};

export const addFacet = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-03');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // BE00 step 6: strict body.
  const body = decodeIdentityBody(transport.value, AddFacetRequestSchema);
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await rate(context, dependencies, 'BE01b-03', resolved.value);
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseIdentityCommandHeaders(context.req.raw, false);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    ...body.value,
    request: context.req.raw,
    session: resolved.value,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: null,
  };
  const port = dependencies.identityAuthority?.addFacet;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-03',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: null,
      mutation: true,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    FacetMutationResponseSchema,
    201,
  );
};

export const removeFacet = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-04');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = IdentityFacetPathSchema.safeParse({
    facetCode: context.req.param('facetCode'),
  });
  if (!path.success)
    return responseForAuthError(
      context,
      pathError('The facet identifier is invalid.'),
    );
  // BE00 step 6: strict body.
  const body = decodeIdentityBody(transport.value, IdentityStrictEmptySchema);
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await rate(context, dependencies, 'BE01b-04', resolved.value);
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseIdentityCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    facetCode: path.data.facetCode,
    request: context.req.raw,
    session: resolved.value,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.removeFacet;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-04',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch!,
      mutation: true,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    FacetMutationResponseSchema,
    200,
  );
};
