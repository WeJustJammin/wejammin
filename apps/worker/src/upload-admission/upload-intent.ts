import { createRequestId } from '@wejammin/contracts';

import {
  MAX_UPLOAD_INTENT_TTL_MS,
  StorageDependencyUnavailableError,
} from '../storage/upload-storage';
import {
  UploadBodyLimitExceededError,
  UploadBodyReadAbortedError,
  decodeUploadIntentBody,
  readBoundedUploadIntentBody,
} from './upload-intent-body';
import {
  authorizeUploadIntent,
  commitUploadIntent,
  resolveUploadPrincipal,
} from './upload-intent-command';
import { verifyCsrfToken, verifySameOrigin } from '../authentication/boundary';
import {
  dependencyError,
  invalid,
  responseForError,
  tooLarge,
  unsupportedMediaType,
  UploadAdmissionError,
  withDeadline,
} from './upload-intent-support';
import {
  MAX_BODY_BYTES,
  parseIdempotencyKey,
  parseRequest,
  parseVersion,
} from './upload-intent-validation';
import type {
  UploadAdmissionRepository,
  UploadIntentCreateInput,
  UploadIntentCreateResult,
  UploadIntentHandlerOptions,
  UploadIntentRequest,
  UploadIntentResource,
  UploadPrincipal,
  UploadRateDecision,
  UploadTargetPolicy,
  TargetAuthorization,
} from './upload-intent-types';

export { MAX_UPLOAD_INTENT_TTL_MS };
export type {
  UploadAdmissionRepository,
  UploadIntentCreateInput,
  UploadIntentCreateResult,
  UploadIntentHandlerOptions,
  UploadIntentRequest,
  UploadIntentResource,
  UploadPrincipal,
  UploadRateDecision,
  UploadTargetPolicy,
  TargetAuthorization,
};

/**
 * BE00 step 2 for a cookie-authenticated JSON mutation: exact method,
 * same-origin, declared size, content type, then the session-bound CSRF token.
 */
const transportChecks = async (
  request: Request,
  maxBodyBytes: number,
): Promise<void> => {
  if (request.method !== 'POST')
    throw invalid('The request method is invalid.');
  const origin = verifySameOrigin(request);
  if (origin !== null)
    throw new UploadAdmissionError('FORBIDDEN', 403, origin.message);
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength))
      throw invalid('The request content length is invalid.');
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBodyBytes)
      throw tooLarge(maxBodyBytes);
  }
  const contentType = request.headers.get('content-type');
  if (
    contentType === null ||
    contentType.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json'
  )
    throw unsupportedMediaType();
  const csrf = await verifyCsrfToken(request);
  if (csrf !== null)
    throw new UploadAdmissionError('FORBIDDEN', 403, csrf.message);
};

const parseJsonBody = (bytes: Uint8Array): unknown => {
  let bodyText: string;
  try {
    bodyText = decodeUploadIntentBody(bytes);
  } catch {
    throw invalid('The request body could not be read.');
  }
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw invalid('The request body is not valid JSON.');
  }
};

export const createUploadIntentHandler = (
  options: UploadIntentHandlerOptions,
) => {
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const deadlineMs = options.deadlineMs ?? 15_000;
  if (
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    maxBodyBytes > MAX_BODY_BYTES ||
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1
  )
    throw new Error('Upload intent configuration is invalid.');
  return async (request: Request): Promise<Response> => {
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    try {
      await transportChecks(request, maxBodyBytes);
      let bytes: Uint8Array;
      try {
        bytes = await withDeadline(
          (signal) =>
            readBoundedUploadIntentBody(request, maxBodyBytes, signal),
          deadlineMs,
        );
      } catch (error) {
        if (error instanceof UploadBodyLimitExceededError)
          throw tooLarge(maxBodyBytes);
        if (error instanceof UploadBodyReadAbortedError)
          throw dependencyError();
        if (error instanceof StorageDependencyUnavailableError)
          throw dependencyError();
        throw invalid('The request body could not be read.');
      }
      return await withDeadline(async (signal) => {
        const principal = await resolveUploadPrincipal(
          options,
          request,
          signal,
        );
        // BE00 step 6: strict body, after the session.
        const parsed = parseRequest(parseJsonBody(bytes), options.policies);
        await authorizeUploadIntent(options, parsed, principal, signal);
        // BE00 step 8: exact Idempotency-Key and If-Match follow authorization.
        const idempotencyKey = parseIdempotencyKey(
          request.headers.get('idempotency-key'),
        );
        const ifMatch = parseVersion(
          request.headers.get('if-match'),
          !parsed.policy.immutable,
        );
        return commitUploadIntent(
          options,
          principal,
          parsed,
          ifMatch,
          idempotencyKey,
          requestId,
          signal,
        );
      }, deadlineMs);
    } catch (error) {
      if (error instanceof UploadAdmissionError)
        return responseForError(requestId, error);
      if (error instanceof StorageDependencyUnavailableError)
        return responseForError(requestId, dependencyError());
      return responseForError(
        requestId,
        new UploadAdmissionError(
          'INTERNAL_ERROR',
          500,
          'An unexpected error occurred.',
        ),
      );
    }
  };
};
