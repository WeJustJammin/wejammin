import {
  ActingContextBindingResponseSchema,
  ActingContextListResponseSchema,
  BindContextRequestSchema,
  IdentityPartyPathSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  admitJsonMutationTransport,
  authError,
  responseForAuthError,
} from '../authentication/boundary';
import { parseClientBindingIdHeader } from '../authentication/client-binding-header';
import {
  configureIdentityRoute,
  parseIdentityCommandHeaders,
  decodeIdentityBody,
  rejectUnexpectedIdentityQuery,
} from './route-support';
import {
  execute,
  executePublic,
  pathError,
  rate,
  resolve,
} from './handler-support';
import type { RecoveryState } from './recovery';

export const readActingContexts = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-12');
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // BE00 step 6: strict path and query.
  const query = rejectUnexpectedIdentityQuery(context.req.raw, true);
  if (!query.ok) return responseForAuthError(context, query);
  const limited = await rate(context, dependencies, 'BE01b-12', resolved.value);
  if (limited !== null) return limited;
  const input = {
    request: context.req.raw,
    session: resolved.value,
    cursor: query.value.cursor,
  };
  const port = dependencies.identityAuthority?.readActingContexts;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-12',
    {
      session: resolved.value,
      idempotencyKey: '',
      ifMatch: null,
      mutation: false,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    ActingContextListResponseSchema,
    200,
  );
};

export const bindActingContext = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-13');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // The session step already refused a malformed binding header, so the value
  // read here is a valid optional selector.
  const bindingId = parseClientBindingIdHeader(context.req.raw) as Extract<
    ReturnType<typeof parseClientBindingIdHeader>,
    { ok: true }
  >;
  // BE00 step 6: strict body.
  const body = decodeIdentityBody(transport.value, BindContextRequestSchema);
  if (!body.ok) return responseForAuthError(context, body);
  if (
    bindingId.value !== null &&
    bindingId.value !== body.value.clientBindingId
  ) {
    return responseForAuthError(
      context,
      authError(
        400,
        'INVALID_REQUEST',
        'The context binding selector does not match the request body.',
        {
          violations: [
            {
              path: '/headers/x-client-binding-id',
              code: 'binding_id_mismatch',
              message: 'The value is invalid.',
            },
          ],
        },
      ),
    );
  }
  // BE00 step 7: quota.
  const limited = await rate(context, dependencies, 'BE01b-13', resolved.value);
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
  const port = dependencies.identityAuthority?.bindActingContext;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-13',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: null,
      mutation: true,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    ActingContextBindingResponseSchema,
    201,
  );
};

export const readPublicProjection = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-18');
  const path = IdentityPartyPathSchema.safeParse({
    partyId: context.req.param('partyId'),
  });
  if (!path.success)
    return responseForAuthError(
      context,
      pathError('The party identifier is invalid.'),
    );
  const query = rejectUnexpectedIdentityQuery(context.req.raw);
  if (!query.ok) return responseForAuthError(context, query);
  const limited = await rate(context, dependencies, 'BE01b-18', null);
  if (limited !== null) return limited;
  const input = { request: context.req.raw, partyId: path.data.partyId };
  const port = dependencies.identityAuthority?.readPublicProjection;
  return executePublic(
    context,
    dependencies,
    state,
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
  );
};
