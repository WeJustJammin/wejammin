import type {
  ContentSchemaRegistryListQuery,
  ContentTypeDraftRequest,
  FieldSchemaChangeRequest,
  RelationBindingRequest,
  SchemaActivationRequest,
} from './contracts';
import { humanBodySchemas } from './admission';
import {
  checkOrigin,
  csrfErrorIfCookie,
  dependencyDeadline,
  parseJsonBody,
  parseMutationHeaders,
  rejectReadMutationHeadersOrBody,
  requireCapability,
  validHumanSession,
} from './admission';
import type { ContentSchemaRegistryDependencies } from './types';
import type { FeatureContext } from './route-types';
import { CMS_STEP_UP_ALLOWED_METHODS } from './production-errors';
import { errorResponse, policyFor, setRateHeaders } from './route-response';
import type { RouteExecutor } from './route-execution';

export type HumanMutation = (
  context: FeatureContext,
  operationId: 'CMS-03A-01' | 'CMS-03A-02' | 'CMS-03A-03' | 'CMS-03A-04',
  bodySchema: (typeof humanBodySchemas)[
    'CMS-03A-01' | 'CMS-03A-02' | 'CMS-03A-03' | 'CMS-03A-04'],
  path?: Readonly<Record<string, string>>,
) => Promise<Response>;

export type ProtectedRead = (
  context: FeatureContext,
  operationId: 'CMS-03A-06' | 'CMS-03A-07',
  path?: Readonly<Record<string, string>>,
  query?: ContentSchemaRegistryListQuery,
) => Promise<Response>;

export const createHumanHandlers = (
  dependencies: ContentSchemaRegistryDependencies,
  execute: RouteExecutor,
): Readonly<{ humanMutation: HumanMutation; protectedRead: ProtectedRead }> => {
  const humanMutation: HumanMutation = async (
    context,
    operationId,
    bodySchema,
    path = {},
  ): Promise<Response> => {
    const body = await parseJsonBody<
      | ContentTypeDraftRequest
      | FieldSchemaChangeRequest
      | RelationBindingRequest
      | SchemaActivationRequest
    >(context.req.raw, bodySchema);
    if (!body.ok) return errorResponse(context, body, context.get('requestId'));
    const headers = parseMutationHeaders(context.req.raw, operationId);
    if (!headers.ok)
      return errorResponse(context, headers, context.get('requestId'));
    const origin = checkOrigin(context.req.raw, dependencies.humanOrigins);
    if (origin !== null)
      return errorResponse(context, origin, context.get('requestId'));
    const sessionResult = await dependencyDeadline(
      (signal) => dependencies.resolveSession(context.req.raw, signal),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!sessionResult.ok)
      return errorResponse(context, sessionResult, context.get('requestId'));
    const validSession = validHumanSession(sessionResult.value);
    if (validSession !== null)
      return errorResponse(context, validSession, context.get('requestId'));
    const capability = requireCapability(sessionResult.value, operationId);
    if (capability !== null)
      return errorResponse(context, capability, context.get('requestId'));
    if (operationId === 'CMS-03A-04' && !sessionResult.value.mfaFresh)
      return errorResponse(
        context,
        {
          ok: false,
          status: 401,
          code: 'STEP_UP_REQUIRED',
          message: 'Recent verification is required.',
          // BE00: a missing recent step-up is recoverable by completing
          // recent verification, not by reauthenticating. Only methods the
          // server is actually configured to accept may be advertised.
          details: {
            allowedMethods: CMS_STEP_UP_ALLOWED_METHODS,
            recoveryAction: 'step_up',
          },
        },
        context.get('requestId'),
      );
    const csrf = csrfErrorIfCookie(context.req.raw);
    if (csrf !== null)
      return errorResponse(context, csrf, context.get('requestId'));
    const rate = await dependencyDeadline(
      (signal) =>
        dependencies.rateLimit(
          {
            operationId,
            request: context.req.raw,
            actorId: sessionResult.value.userId,
            actingPartyId: sessionResult.value.actingPartyId,
            principalClass: 'human',
            rateClass: policyFor(operationId).rateClass,
            limit: policyFor(operationId).rateLimit,
            windowSeconds: policyFor(operationId).rateWindowSeconds,
          },
          signal,
        ),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!rate.ok) return errorResponse(context, rate, context.get('requestId'));
    setRateHeaders(context, rate.value);
    if (!rate.value.allowed)
      return errorResponse(
        context,
        {
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          details: {
            limit: rate.value.limit,
            resetAt: rate.value.resetAt,
            retryAfterSeconds: 5,
          },
          retryAfterSeconds: 5,
        },
        context.get('requestId'),
      );
    return execute(context, operationId, 'human', {
      operationId,
      requestId: context.get('requestId'),
      request: context.req.raw,
      session: sessionResult.value,
      path,
      body: body.value as
        | ContentTypeDraftRequest
        | FieldSchemaChangeRequest
        | RelationBindingRequest
        | SchemaActivationRequest,
      idempotencyKey: headers.value.idempotencyKey,
      ...(headers.value.ifMatch === undefined
        ? {}
        : { ifMatch: headers.value.ifMatch }),
    });
  };

  const protectedRead: ProtectedRead = async (
    context,
    operationId,
    path = {},
    query,
  ): Promise<Response> => {
    const readHeaders = await rejectReadMutationHeadersOrBody(context.req.raw);
    if (readHeaders !== null)
      return errorResponse(context, readHeaders, context.get('requestId'));
    const origin = checkOrigin(context.req.raw, dependencies.humanOrigins);
    if (origin !== null)
      return errorResponse(context, origin, context.get('requestId'));
    const sessionResult = await dependencyDeadline(
      (signal) => dependencies.resolveSession(context.req.raw, signal),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!sessionResult.ok)
      return errorResponse(context, sessionResult, context.get('requestId'));
    const validSession = validHumanSession(sessionResult.value);
    if (validSession !== null)
      return errorResponse(context, validSession, context.get('requestId'));
    const capability = requireCapability(sessionResult.value, operationId);
    if (capability !== null)
      return errorResponse(context, capability, context.get('requestId'));
    const rate = await dependencyDeadline(
      (signal) =>
        dependencies.rateLimit(
          {
            operationId,
            request: context.req.raw,
            actorId: sessionResult.value.userId,
            actingPartyId: sessionResult.value.actingPartyId,
            principalClass: 'human',
            rateClass: policyFor(operationId).rateClass,
            limit: policyFor(operationId).rateLimit,
            windowSeconds: policyFor(operationId).rateWindowSeconds,
          },
          signal,
        ),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!rate.ok) return errorResponse(context, rate, context.get('requestId'));
    setRateHeaders(context, rate.value);
    if (!rate.value.allowed)
      return errorResponse(
        context,
        {
          ok: false,
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          details: {
            limit: rate.value.limit,
            resetAt: rate.value.resetAt,
            retryAfterSeconds: 5,
          },
          retryAfterSeconds: 5,
        },
        context.get('requestId'),
      );
    return execute(context, operationId, 'human', {
      operationId,
      requestId: context.get('requestId'),
      request: context.req.raw,
      session: sessionResult.value,
      path,
      ...(query === undefined ? {} : { query }),
    });
  };

  return { humanMutation, protectedRead };
};
