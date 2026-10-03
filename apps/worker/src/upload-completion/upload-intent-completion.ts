import { UploadCompletionRequestSchema } from '@wejammin/contracts';
import {
  completeUpload,
  type UploadCompletionInput,
  type UploadCompletionSession,
} from '@wejammin/application';

import type { WorkerApp, WorkerContext } from '../index';
import { verifyCsrfToken, verifySameOrigin } from '../authentication/boundary';
import {
  DEADLINE,
  parseContentLength,
  readJsonBody,
  type DeadlineRecovery,
  runWithDeadline,
} from './upload-intent-completion-support';
import {
  dependencyError,
  invalidError,
  rateLimited,
  routeError,
  UPLOAD_COMPLETION_DEADLINE_MS,
  UPLOAD_COMPLETION_CONCURRENT_LIMIT,
  UPLOAD_COMPLETION_MAX_BODY_BYTES,
  UPLOAD_COMPLETION_PATH,
  UPLOAD_COMPLETION_PARTY_LIMIT,
  UPLOAD_COMPLETION_UUID,
  UPLOAD_COMPLETION_USER_LIMIT,
  validRateDecision,
  validSession,
  type UploadCompletionRouteDependencies,
  type UploadCompletionRouteResult,
  type UploadCompletionRateLimitDecision,
} from './upload-intent-completion-types';
import {
  responseForAccepted,
  responseForError,
} from './upload-intent-completion-response';

export {
  UPLOAD_COMPLETION_DEADLINE_MS,
  UPLOAD_COMPLETION_CONCURRENT_LIMIT,
  UPLOAD_COMPLETION_MAX_BODY_BYTES,
  UPLOAD_COMPLETION_PATH,
  UPLOAD_COMPLETION_PARTY_LIMIT,
  UPLOAD_COMPLETION_USER_LIMIT,
} from './upload-intent-completion-types';
export type {
  UploadCompletionPortsFactoryInput,
  UploadCompletionRateLimitDecision,
  UploadCompletionRateLimitInput,
  UploadCompletionRouteDependencies,
} from './upload-intent-completion-types';

/** Header-level refusals BE00 step 8 owns: they follow authorization and quota. */
const isConcurrencyHeaderIssue = (issue: {
  path: readonly PropertyKey[];
}): boolean =>
  issue.path[0] === 'headers' &&
  (issue.path[1] === 'idempotencyKey' || issue.path[1] === 'ifMatch');

const execute = async (
  context: WorkerContext,
  dependencies: UploadCompletionRouteDependencies,
  signal: AbortSignal,
  registerRecovery: (recovery: DeadlineRecovery) => void,
): Promise<UploadCompletionRouteResult> => {
  const request = context.req.raw;
  const maxBodyBytes =
    dependencies.maxBodyBytes ?? UPLOAD_COMPLETION_MAX_BODY_BYTES;
  if (
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    maxBodyBytes > UPLOAD_COMPLETION_MAX_BODY_BYTES
  ) {
    return dependencyError();
  }
  // BE00 step 2: same-origin, declared size, content type, session-bound CSRF.
  const originError = verifySameOrigin(request);
  if (originError !== null) {
    return routeError('FORBIDDEN', 403, originError.message);
  }
  const lengthError = parseContentLength(request, maxBodyBytes);
  if (lengthError !== null) return lengthError;
  if (request.headers.get('content-type') !== 'application/json') {
    return routeError(
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'The upload completion requires application/json.',
      { allowedMediaTypes: ['application/json'] },
    );
  }
  const csrfError = await verifyCsrfToken(request);
  if (csrfError !== null) {
    return routeError('FORBIDDEN', 403, csrfError.message);
  }
  const body = await readJsonBody(request, maxBodyBytes, signal);
  if (body.kind === 'error') return body.error;

  // BE00 step 4: the verified session.
  let session: UploadCompletionSession | null;
  try {
    session = await dependencies.resolveSession({ request, signal });
  } catch {
    return dependencyError();
  }
  if (!validSession(session)) return dependencyError();
  if (session === null) {
    return routeError('UNAUTHENTICATED', 401, 'Authentication is required.', {
      recoveryAction: 'reauthenticate',
    });
  }

  // BE00 step 6: strict query, path, then body (and the content type header).
  if (new URL(request.url).search !== '') {
    return invalidError('The upload completion request is invalid.', {
      violations: [
        {
          code: 'query_not_allowed',
          message: 'Query parameters are not supported.',
          path: '/query',
        },
      ],
    });
  }
  const path = context.req.param('uploadIntentId');
  if (typeof path !== 'string' || !UPLOAD_COMPLETION_UUID.test(path)) {
    return invalidError('The upload intent path is invalid.', {
      violations: [
        {
          code: 'invalid_uuid',
          message: 'Expected a canonical upload intent identifier.',
          path: '/path/uploadIntentId',
        },
      ],
    });
  }
  const parsedRequest = UploadCompletionRequestSchema.safeParse({
    body: body.value,
    headers: {
      contentType: request.headers.get('content-type'),
      idempotencyKey: request.headers.get('idempotency-key'),
      ifMatch: request.headers.get('if-match'),
    },
    uploadIntentId: path,
  });
  if (
    !parsedRequest.success &&
    !parsedRequest.error.issues.every(isConcurrencyHeaderIssue)
  ) {
    return invalidError();
  }

  const nowMs = dependencies.now?.() ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return dependencyError();
  let decision: UploadCompletionRateLimitDecision;
  try {
    decision = await dependencies.rateLimit({
      nowMs,
      concurrentLimit: UPLOAD_COMPLETION_CONCURRENT_LIMIT,
      partyLimit: UPLOAD_COMPLETION_PARTY_LIMIT,
      request,
      session,
      signal,
      userLimit: UPLOAD_COMPLETION_USER_LIMIT,
    });
  } catch {
    return dependencyError();
  }
  if (!validRateDecision(decision)) return dependencyError();
  if (!decision.allowed) return rateLimited(decision);
  // BE00 step 8: the exact Idempotency-Key and If-Match follow quota.
  if (!parsedRequest.success) return invalidError();

  let ports;
  try {
    ports =
      typeof dependencies.ports === 'function'
        ? await dependencies.ports({ request, session, signal })
        : dependencies.ports;
  } catch {
    return dependencyError();
  }

  if (typeof ports?.persistence?.cancelCompletion !== 'function') {
    return dependencyError();
  }

  return completeUpload({
    authorization: ports.authorization,
    digest: ports.digest,
    now: () => new Date(nowMs).toISOString(),
    persistence: ports.persistence,
    queue: ports.queue,
    request: parsedRequest.data,
    registerDeadlineRecovery: registerRecovery,
    session,
    signal,
    storage: ports.storage,
  } satisfies UploadCompletionInput);
};

export const registerUploadCompletionRoute = (
  app: WorkerApp,
  dependencies: UploadCompletionRouteDependencies | undefined,
): void => {
  app.post(UPLOAD_COMPLETION_PATH, async (context) => {
    context.set('operation', 'uploadIntent.complete');
    if (dependencies === undefined) {
      return responseForError(
        context,
        routeError(
          'DEPENDENCY_UNAVAILABLE',
          503,
          'Upload completion is not available.',
          {},
          5,
        ),
      );
    }
    const deadlineMs = dependencies.deadlineMs ?? UPLOAD_COMPLETION_DEADLINE_MS;
    if (
      !Number.isSafeInteger(deadlineMs) ||
      deadlineMs < 1 ||
      deadlineMs > UPLOAD_COMPLETION_DEADLINE_MS
    ) {
      return responseForError(context, dependencyError());
    }
    try {
      const result = await runWithDeadline(
        (signal, registerRecovery) =>
          execute(context, dependencies, signal, registerRecovery),
        deadlineMs,
      );
      if (result === DEADLINE) {
        return responseForError(context, dependencyError());
      }
      return result.kind === 'accepted'
        ? responseForAccepted(context, result)
        : responseForError(context, result);
    } catch {
      return responseForError(context, dependencyError());
    }
  });
};
