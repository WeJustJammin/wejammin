import {
  AliasResponseSchema,
  ChangeHandleRequestSchema,
  CreateAliasRequestSchema,
  CreateTransferOfferRequestSchema,
  IdentityAliasPathSchema,
  IdentityStrictEmptySchema,
  PatchAliasRequestSchema,
  TransferOfferResponseSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  admitJsonMutationTransport,
  responseForAuthError,
} from '../authentication/boundary';
import type { AuthenticationSession } from '../authentication/types';
import {
  configureIdentityRoute,
  decodeIdentityBody,
  parseIdentityCommandHeaders,
} from './route-support';
import { execute, pathError, rate, resolve } from './handler-support';
import type { RecoveryState } from './recovery';

type Prepared<T, P> = Readonly<{
  body: T;
  path: P;
  session: AuthenticationSession;
  idempotencyKey: string;
  ifMatch: string | null;
}>;

type PathOutcome<P> =
  | Readonly<{ ok: true; value: P }>
  | Readonly<{ ok: false; response: Response }>;

/**
 * Shared admission in BE00 "Hono Middleware Order": origin, body ceiling,
 * content type and session-bound CSRF (step 2); verified session (steps 4 and
 * 5); strict path and body (step 6); quota (step 7); then the exact
 * Idempotency-Key and If-Match (step 8).
 */
const prepare = async <T, P = null>(
  context: WorkerContext,
  dependencies: WorkerDependencies,
  operationId: Parameters<typeof configureIdentityRoute>[1],
  schema: Parameters<typeof decodeIdentityBody<T>>[1],
  ifMatch: boolean,
  selectPath?: (context: WorkerContext) => PathOutcome<P>,
): Promise<
  | Readonly<{ ok: true; value: Prepared<T, P> }>
  | Readonly<{ ok: false; response: Response }>
> => {
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok)
    return { ok: false, response: responseForAuthError(context, transport) };
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok)
    return { ok: false, response: responseForAuthError(context, resolved) };
  const path =
    selectPath === undefined
      ? ({ ok: true, value: null } as PathOutcome<P>)
      : selectPath(context);
  if (!path.ok) return path;
  const body = decodeIdentityBody(transport.value, schema);
  if (!body.ok)
    return { ok: false, response: responseForAuthError(context, body) };
  const limited = await rate(
    context,
    dependencies,
    operationId,
    resolved.value,
  );
  if (limited !== null) return { ok: false, response: limited };
  const headers = parseIdentityCommandHeaders(context.req.raw, ifMatch);
  if (!headers.ok)
    return { ok: false, response: responseForAuthError(context, headers) };
  return {
    ok: true,
    value: {
      body: body.value,
      path: path.value,
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: ifMatch ? headers.value.ifMatch! : null,
    },
  };
};

const aliasPath = (
  context: WorkerContext,
): PathOutcome<Readonly<{ aliasId: string }>> => {
  const parsed = IdentityAliasPathSchema.safeParse({
    aliasId: context.req.param('aliasId'),
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        response: responseForAuthError(
          context,
          pathError('The alias identifier is invalid.'),
        ),
      };
};

export const createAlias = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-05');
  const prepared = await prepare(
    context,
    dependencies,
    'BE01b-05',
    CreateAliasRequestSchema,
    false,
  );
  if (!prepared.ok) return prepared.response;
  const input = {
    ...prepared.value.body,
    request: context.req.raw,
    session: prepared.value.session,
    idempotencyKey: prepared.value.idempotencyKey,
    ifMatch: null,
  };
  const port = dependencies.identityAuthority?.createAlias;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-05',
    { ...prepared.value, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    AliasResponseSchema,
    201,
  );
};

export const patchAlias = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-06');
  const prepared = await prepare(
    context,
    dependencies,
    'BE01b-06',
    PatchAliasRequestSchema,
    true,
    aliasPath,
  );
  if (!prepared.ok) return prepared.response;
  const input = {
    aliasId: prepared.value.path.aliasId,
    request: context.req.raw,
    session: prepared.value.session,
    idempotencyKey: prepared.value.idempotencyKey,
    ifMatch: prepared.value.ifMatch!,
    ...(prepared.value.body.displayName === undefined
      ? {}
      : { displayName: prepared.value.body.displayName }),
    ...(prepared.value.body.publicLinkState === undefined
      ? {}
      : { publicLinkState: prepared.value.body.publicLinkState }),
  };
  const port = dependencies.identityAuthority?.patchAlias;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-06',
    { ...prepared.value, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    AliasResponseSchema,
    200,
  );
};

export const changeHandle = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-07');
  const prepared = await prepare(
    context,
    dependencies,
    'BE01b-07',
    ChangeHandleRequestSchema,
    true,
    aliasPath,
  );
  if (!prepared.ok) return prepared.response;
  const input = {
    ...prepared.value.body,
    aliasId: prepared.value.path.aliasId,
    request: context.req.raw,
    session: prepared.value.session,
    idempotencyKey: prepared.value.idempotencyKey,
    ifMatch: prepared.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.changeHandle;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-07',
    { ...prepared.value, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    AliasResponseSchema,
    200,
  );
};

export const retireAlias = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-08');
  const prepared = await prepare(
    context,
    dependencies,
    'BE01b-08',
    IdentityStrictEmptySchema,
    true,
    aliasPath,
  );
  if (!prepared.ok) return prepared.response;
  const input = {
    aliasId: prepared.value.path.aliasId,
    request: context.req.raw,
    session: prepared.value.session,
    idempotencyKey: prepared.value.idempotencyKey,
    ifMatch: prepared.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.retireAlias;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-08',
    { ...prepared.value, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    AliasResponseSchema,
    200,
  );
};

export const createTransferOffer = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureIdentityRoute(context, 'BE01b-09');
  const prepared = await prepare(
    context,
    dependencies,
    'BE01b-09',
    CreateTransferOfferRequestSchema,
    false,
    aliasPath,
  );
  if (!prepared.ok) return prepared.response;
  const input = {
    ...prepared.value.body,
    aliasId: prepared.value.path.aliasId,
    request: context.req.raw,
    session: prepared.value.session,
    idempotencyKey: prepared.value.idempotencyKey,
    ifMatch: null,
  };
  const port = dependencies.identityAuthority?.createTransferOffer;
  return execute(
    context,
    dependencies,
    state,
    'BE01b-09',
    { ...prepared.value, mutation: true },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    TransferOfferResponseSchema,
    201,
  );
};
