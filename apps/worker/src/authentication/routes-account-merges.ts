import {
  AuthMergePathSchema,
  AuthorizationStartSchema,
  JobStatusSchema,
  MergeConfirmRequestSchema,
  MergeCaseResourceSchema,
  MergeCreateRequestSchema,
  MergeProofRequestSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext } from '../index';
import {
  appendCookies,
  authError,
  parseIdempotencyKey,
  parseIfMatch,
  admitJsonMutationTransport,
  quotedVersion,
  rejectUnexpectedQuery,
  responseForAuthError,
} from './boundary';
import {
  enforceRate,
  isStepUpFresh,
  jsonSuccess,
  requireSession,
} from './route-support';
import {
  configureRoute,
  missingSliceDependency,
} from './routes-provider-access';
import { stepUpRequiredError } from './step-up';
import type { AuthenticationDependencies } from './types';

const invalidPersistence = (context: WorkerContext): Response =>
  responseForAuthError(
    context,
    authError(
      502,
      'DEPENDENCY_INVALID_RESPONSE',
      'Authentication persistence returned an invalid response.',
    ),
  );

const requireRecentVerification = (
  context: WorkerContext,
  session: Parameters<typeof isStepUpFresh>[0],
): Response | null =>
  isStepUpFresh(session, Date.now())
    ? null
    : responseForAuthError(context, stepUpRequiredError());

export const registerAccountMergeRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.post('/api/v1/account-merges', async (context) => {
    configureRoute(context, 'AUTH-API-12');
    // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
    const transport = await admitJsonMutationTransport(context.req.raw);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 steps 4 and 5: verified session and acting context.
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    // BE00 step 6: strict body.
    const parsed = transport.value.decode(MergeCreateRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    // BE00 step 7: step-up freshness, then quota.
    const stepUpError = requireRecentVerification(context, resolved.value);
    if (stepUpError !== null) return stepUpError;
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-12',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    // BE00 step 8: exact Idempotency-Key and quoted If-Match.
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForAuthError(context, key);
    const version = parseIfMatch(context.req.raw);
    if (!version.ok) return responseForAuthError(context, version);
    if (dependencies.createAccountMerge === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.createAccountMerge(
      {
        session: resolved.value,
        idempotencyKey: key.value,
        ifMatch: version.value,
        request: context.req.raw,
        returnTo: parsed.value.returnTo,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const resource = MergeCaseResourceSchema.safeParse(result.value);
    if (!resource.success) return invalidPersistence(context);
    context.header('etag', quotedVersion(resource.data.version));
    return jsonSuccess(context, resource.data, 201, 'no-store');
  });

  app.get('/api/v1/account-merges/:mergeId', async (context) => {
    configureRoute(context, 'AUTH-API-13');
    // BE00 steps 4 and 5: verified session; strict path and query follow (step 6).
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const path = AuthMergePathSchema.safeParse({
      mergeId: context.req.param('mergeId'),
    });
    if (!path.success) {
      return responseForAuthError(
        context,
        authError(400, 'INVALID_REQUEST', 'The merge identifier is invalid.'),
      );
    }
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-13',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    if (dependencies.readAccountMerge === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.readAccountMerge(
      {
        session: resolved.value,
        mergeId: path.data.mergeId,
        request: context.req.raw,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const resource = MergeCaseResourceSchema.safeParse(result.value);
    if (!resource.success) return invalidPersistence(context);
    context.header('etag', quotedVersion(resource.data.version));
    return jsonSuccess(context, resource.data, 200, 'no-store');
  });

  app.post(
    '/api/v1/account-merges/:mergeId/prove-duplicate',
    async (context) => {
      configureRoute(context, 'AUTH-API-14');
      const transport = await admitJsonMutationTransport(context.req.raw);
      if (!transport.ok) return responseForAuthError(context, transport);
      const resolved = await requireSession(context, dependencies);
      if (!resolved.ok) return responseForAuthError(context, resolved);
      const path = AuthMergePathSchema.safeParse({
        mergeId: context.req.param('mergeId'),
      });
      if (!path.success) {
        return responseForAuthError(
          context,
          authError(400, 'INVALID_REQUEST', 'The merge identifier is invalid.'),
        );
      }
      const parsed = transport.value.decode(MergeProofRequestSchema);
      if (!parsed.ok) return responseForAuthError(context, parsed);
      const stepUpError = requireRecentVerification(context, resolved.value);
      if (stepUpError !== null) return stepUpError;
      const rateError = await enforceRate(
        context,
        dependencies,
        'AUTH-API-14',
        resolved.value,
      );
      if (rateError !== null) return rateError;
      const key = parseIdempotencyKey(context.req.raw);
      if (!key.ok) return responseForAuthError(context, key);
      const version = parseIfMatch(context.req.raw);
      if (!version.ok) return responseForAuthError(context, version);
      if (dependencies.startAccountMergeProof === undefined)
        return missingSliceDependency(context);
      const result = await dependencies.startAccountMergeProof(
        {
          session: resolved.value,
          idempotencyKey: key.value,
          ifMatch: version.value,
          request: context.req.raw,
          mergeId: path.data.mergeId,
          provider: parsed.value.provider,
          returnTo: parsed.value.returnTo,
        },
        context.env,
        new AbortController().signal,
      );
      if (!result.ok) return responseForAuthError(context, result);
      const resource = AuthorizationStartSchema.safeParse(
        result.value.resource,
      );
      if (!resource.success) return invalidPersistence(context);
      const response = jsonSuccess(context, resource.data, 201, 'no-store');
      appendCookies(response, result.value.cookies);
      return response;
    },
  );

  app.post('/api/v1/account-merges/:mergeId/confirm', async (context) => {
    configureRoute(context, 'AUTH-API-15');
    const transport = await admitJsonMutationTransport(context.req.raw);
    if (!transport.ok) return responseForAuthError(context, transport);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const path = AuthMergePathSchema.safeParse({
      mergeId: context.req.param('mergeId'),
    });
    if (!path.success) {
      return responseForAuthError(
        context,
        authError(400, 'INVALID_REQUEST', 'The merge identifier is invalid.'),
      );
    }
    const parsed = transport.value.decode(MergeConfirmRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const stepUpError = requireRecentVerification(context, resolved.value);
    if (stepUpError !== null) return stepUpError;
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-15',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForAuthError(context, key);
    const version = parseIfMatch(context.req.raw);
    if (!version.ok) return responseForAuthError(context, version);
    if (dependencies.confirmAccountMerge === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.confirmAccountMerge(
      {
        session: resolved.value,
        idempotencyKey: key.value,
        ifMatch: version.value,
        request: context.req.raw,
        mergeId: path.data.mergeId,
        conflictPlanVersion: parsed.value.conflictPlanVersion,
        acknowledgements: parsed.value.acknowledgements,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const resource = JobStatusSchema.safeParse(result.value);
    if (!resource.success) return invalidPersistence(context);
    context.header('location', `/api/v1/jobs/${resource.data.id}`);
    return jsonSuccess(context, resource.data, 202, 'no-store');
  });
};
