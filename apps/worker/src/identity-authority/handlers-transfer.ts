import {
  AliasResponseSchema,
  IdentityOfferPathSchema,
  IdentityStrictEmptySchema,
  TransferOfferResponseSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  admitJsonMutationTransport,
  responseForAuthError,
} from '../authentication/boundary';
import {
  configureIdentityRoute,
  parseIdentityCommandHeaders,
  decodeIdentityBody,
} from './route-support';
import { execute, pathError, rate, resolve } from './handler-support';
import type { RecoveryState } from './recovery';

const transferDecision = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
  operationId: 'BE01b-10' | 'BE01b-11',
  accept: boolean,
): Promise<Response> => {
  configureIdentityRoute(context, operationId);
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolve(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = IdentityOfferPathSchema.safeParse({
    offerId: context.req.param('offerId'),
  });
  if (!path.success)
    return responseForAuthError(
      context,
      pathError('The transfer offer identifier is invalid.'),
    );
  // BE00 step 6: strict body.
  const body = decodeIdentityBody(transport.value, IdentityStrictEmptySchema);
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await rate(
    context,
    dependencies,
    operationId,
    resolved.value,
  );
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseIdentityCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    offerId: path.data.offerId,
    request: context.req.raw,
    session: resolved.value,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const authority = dependencies.identityAuthority;
  const execution = {
    session: resolved.value,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
    mutation: true,
  } as const;
  if (accept) {
    const port = authority?.acceptTransferOffer;
    return execute(
      context,
      dependencies,
      state,
      operationId,
      execution,
      port === undefined
        ? undefined
        : (signal: AbortSignal) => port(input, context.env, signal),
      AliasResponseSchema,
      200,
    );
  }
  const port = authority?.declineTransferOffer;
  return execute(
    context,
    dependencies,
    state,
    operationId,
    execution,
    port === undefined
      ? undefined
      : (signal: AbortSignal) => port(input, context.env, signal),
    TransferOfferResponseSchema,
    200,
  );
};

export const acceptTransferOffer = (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> =>
  transferDecision(context, dependencies, state, 'BE01b-10', true);

export const declineTransferOffer = (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> =>
  transferDecision(context, dependencies, state, 'BE01b-11', false);
