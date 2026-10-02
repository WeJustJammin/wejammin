import {
  AuthCallbackQuerySchema,
  AuthStartAcceptedSchema,
  AuthorizationStartSchema,
  EmailStartRequestSchema,
  OAuthStartRequestSchema,
  ProviderCatalogSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext } from '../index';
import {
  appendCookies,
  authError,
  parseIdempotencyKey,
  parseIfMatch,
  parseJsonBody,
  rejectUnexpectedQuery,
  responseForAuthError,
  safeIdentifierDigest,
  verifySameOriginCsrf,
} from './boundary';
import {
  enforceRate,
  isStepUpFresh,
  jsonSuccess,
  policyFor,
  requireSession,
} from './route-support';
import { stepUpRequiredError } from './step-up';
import type { AuthenticationDependencies } from './types';

export const missingDependencies = (context: WorkerContext): Response =>
  responseForAuthError(
    context,
    authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    ),
  );

export const configureRoute = (
  context: WorkerContext,
  operationId: Parameters<typeof policyFor>[0],
): void => {
  const policy = policyFor(operationId);
  context.set('operation', operationId);
  context.header('cache-control', policy.cacheControl);
  context.header('vary', 'Origin');
};

export const missingSliceDependency = (context: WorkerContext): Response =>
  missingDependencies(context);

const callbackCandidate = (request: Request): unknown => {
  const params = new URL(request.url).searchParams;
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { duplicate: true };
  }
  return Object.fromEntries(entries);
};

export const registerProviderAccessRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.get('/api/v1/auth/providers', async (context) => {
    configureRoute(context, 'AUTH-API-01');
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-01',
      null,
    );
    if (rateError !== null) return rateError;
    const result = await dependencies.loadProviderCatalog(
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const payload = ProviderCatalogSchema.parse(result.value);
    context.header('etag', `"${payload.version}"`);
    return jsonSuccess(context, payload, 200, 'public, max-age=60');
  });

  app.post('/api/v1/auth/email/start', async (context) => {
    configureRoute(context, 'AUTH-API-02');
    const parsed = await parseJsonBody(
      context.req.raw,
      EmailStartRequestSchema,
    );
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const digest = await safeIdentifierDigest(parsed.value.email);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-02',
      null,
      digest,
    );
    if (rateError !== null) return rateError;
    const result = await dependencies.startEmail(
      parsed.value,
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const response = jsonSuccess(
      context,
      AuthStartAcceptedSchema.parse(result.value.resource),
      202,
      'no-store',
    );
    appendCookies(response, result.value.cookies);
    return response;
  });

  app.post('/api/v1/auth/oauth/start', async (context) => {
    configureRoute(context, 'AUTH-API-03');
    const parsed = await parseJsonBody(
      context.req.raw,
      OAuthStartRequestSchema,
    );
    if (!parsed.ok) return responseForAuthError(context, parsed);
    let session = null;
    let idempotencyKey: string | null = null;
    let ifMatch: string | null = null;
    if (parsed.value.intent !== 'sign_in') {
      const csrfError = await verifySameOriginCsrf(context.req.raw);
      if (csrfError !== null) return responseForAuthError(context, csrfError);
      const key = parseIdempotencyKey(context.req.raw);
      if (!key.ok) return responseForAuthError(context, key);
      const version = parseIfMatch(context.req.raw);
      if (!version.ok) return responseForAuthError(context, version);
      idempotencyKey = key.value;
      ifMatch = version.value;
      const resolved = await requireSession(context, dependencies);
      if (!resolved.ok) return responseForAuthError(context, resolved);
      session = resolved.value;
      if (!isStepUpFresh(session, Date.now())) {
        return responseForAuthError(context, stepUpRequiredError());
      }
    }
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-03',
      session,
    );
    if (rateError !== null) return rateError;
    if (parsed.value.intent === 'link') {
      if (dependencies.startLoginMethodLink === undefined)
        return missingDependencies(context);
      const result = await dependencies.startLoginMethodLink(
        {
          session: session!,
          idempotencyKey: idempotencyKey!,
          ifMatch: ifMatch!,
          request: context.req.raw,
          provider: parsed.value.provider,
          returnTo: parsed.value.returnTo,
        },
        context.env,
        new AbortController().signal,
      );
      if (!result.ok) return responseForAuthError(context, result);
      const response = jsonSuccess(
        context,
        AuthorizationStartSchema.parse(result.value.resource),
        201,
        'no-store',
      );
      appendCookies(response, result.value.cookies);
      return response;
    }
    if (parsed.value.intent === 'prove_merge') {
      if (dependencies.startAccountMergeProof === undefined)
        return missingDependencies(context);
      const result = await dependencies.startAccountMergeProof(
        {
          session: session!,
          idempotencyKey: idempotencyKey!,
          ifMatch: ifMatch!,
          request: context.req.raw,
          provider: parsed.value.provider,
          returnTo: parsed.value.returnTo,
          mergeId: parsed.value.mergeId!,
        },
        context.env,
        new AbortController().signal,
      );
      if (!result.ok) return responseForAuthError(context, result);
      const response = jsonSuccess(
        context,
        AuthorizationStartSchema.parse(result.value.resource),
        201,
        'no-store',
      );
      appendCookies(response, result.value.cookies);
      return response;
    }
    const result = await dependencies.startOAuth(
      parsed.value,
      session,
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const response = jsonSuccess(
      context,
      AuthorizationStartSchema.parse(result.value.resource),
      201,
      'no-store',
    );
    appendCookies(response, result.value.cookies);
    return response;
  });

  app.get('/auth/callback', async (context) => {
    configureRoute(context, 'AUTH-API-04');
    const parsed = AuthCallbackQuerySchema.safeParse(
      callbackCandidate(context.req.raw),
    );
    if (!parsed.success) {
      return responseForAuthError(
        context,
        authError(
          400,
          'AUTH_CALLBACK_INVALID',
          'The authentication callback is invalid.',
        ),
      );
    }
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-04',
      null,
    );
    if (rateError !== null) return rateError;
    const result = await dependencies.completeCallback(
      parsed.data,
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const response = context.body(null, 303, {
      location: result.value.location,
      'cache-control': 'no-store',
    });
    appendCookies(response, result.value.cookies);
    return response;
  });
};
