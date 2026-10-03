import { ApiErrorSchema, type IdentityOperationId } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  applyRateHeaders,
  responseForAuthError,
} from '../authentication/boundary';
import { parseClientBindingIdHeader } from '../authentication/client-binding-header';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import {
  identityError,
  identityPolicy,
  invalidPersistence,
  quotedVersion,
} from './route-parse';

export const requireIdentitySession = async (
  context: WorkerContext,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  const bindingId = parseClientBindingIdHeader(context.req.raw);
  if (!bindingId.ok) return bindingId;
  const auth = context.get('identityAuth');
  if (auth === undefined) {
    return identityError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    );
  }
  try {
    return await auth.resolveSession(
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
  } catch {
    return identityError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    );
  }
};

export const enforceIdentityRate = async (
  context: WorkerContext,
  operationId: IdentityOperationId,
  session: AuthenticationSession | null,
): Promise<Response | null> => {
  const auth = context.get('identityAuth');
  if (auth === undefined) return null;
  const policy = identityPolicy(operationId);
  try {
    const result = await auth.rateLimit(
      {
        operationId,
        request: context.req.raw,
        authUserId: session?.authUserId ?? null,
        identifierDigest: null,
        limit: policy.rateLimit,
        windowSeconds: policy.rateWindowSeconds,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    applyRateHeaders(context, result.value);
    if (result.value.allowed) return null;
    return responseForAuthError(
      context,
      identityError(429, 'RATE_LIMITED', 'Too many requests.'),
    );
  } catch {
    return responseForAuthError(
      context,
      identityError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Identity rate limiting is temporarily unavailable.',
      ),
    );
  }
};

export const missingIdentityDependency = (context: WorkerContext): Response =>
  responseForAuthError(
    context,
    identityError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Identity authority is temporarily unavailable.',
    ),
  );

export const callIdentityPort = async <T>(
  operationId: IdentityOperationId,
  fn: (signal: AbortSignal) => Promise<AuthenticationResult<T>>,
): Promise<AuthenticationResult<T>> => {
  const controller = new AbortController();
  const timeoutMs = identityPolicy(operationId).timeoutMs;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (
      timedOut ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      return identityError(
        504,
        'DEPENDENCY_TIMEOUT',
        'Identity persistence timed out.',
      );
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'ok' in error &&
      error.ok === false
    )
      return error as AuthenticationError;
    return identityError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Identity persistence is temporarily unavailable.',
    );
  } finally {
    clearTimeout(timer);
  }
};

export const identityResponse = <T>(
  context: WorkerContext,
  result: AuthenticationResult<T>,
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false };
  },
  status: 200 | 201 | 202,
): Response => {
  if (!result.ok) return responseForAuthError(context, result);
  const parsed = schema.safeParse(result.value);
  if (!parsed.success) return invalidPersistence(context);
  context.header('etag', quotedVersion(readVersion(parsed.data)));
  context.header('cache-control', 'no-store');
  return context.json(parsed.data, status);
};

const readVersion = (value: unknown): string => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  )
    return value.version;
  return '1';
};

export const setIdentityAuth = (
  context: WorkerContext,
  auth: AuthenticationDependencies,
): void => {
  context.set('identityAuth', auth);
};

export const responseForIdentityError = responseForAuthError;

export const safeApiError = (
  context: WorkerContext,
  code: string,
  message: string,
  status: AuthenticationError['status'],
  details: AuthenticationError['details'] = {},
): Response =>
  context.json(
    ApiErrorSchema.parse({
      code,
      details,
      message,
      requestId: context.get('requestId'),
    }),
    status,
  );
