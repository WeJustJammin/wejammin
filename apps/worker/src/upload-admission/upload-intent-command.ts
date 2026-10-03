import { createRequestId } from '@wejammin/contracts';

import {
  MAX_UPLOAD_INTENT_TTL_MS,
  StorageDependencyUnavailableError,
  generateServerObjectKey,
  salvageSignedUploadForRevocation,
  type SignedUpload,
  validateSignedUpload,
} from '../storage/upload-storage';
import {
  assertDeadlineActive,
  cancelCanonicalIntent,
  cleanupSignedUpload,
  authorityError,
  dependencyError,
  markCommitStarted,
  rateLimited,
  UploadAdmissionError,
} from './upload-intent-support';
import {
  OPERATION,
  digest,
  isUploadRateDecision,
  signedUrlBindsGeneratedObject,
  validatePrincipal,
  validateResource,
} from './upload-intent-validation';
import type {
  UploadIntentCreateResult,
  UploadIntentHandlerOptions,
  UploadIntentRequest,
  UploadIntentResource,
  UploadPrincipal,
  UploadRateDecision,
  TargetAuthorization,
  UploadTargetPolicy,
} from './upload-intent-types';

/** BE00 step 4: the verified principal, before any validation of the body. */
export const resolveUploadPrincipal = async (
  options: UploadIntentHandlerOptions,
  request: Request,
  signal: AbortSignal,
): Promise<UploadPrincipal> => {
  let principal: UploadPrincipal | null;
  try {
    assertDeadlineActive(signal);
    principal = await options.resolvePrincipal(request, signal);
    assertDeadlineActive(signal);
  } catch {
    throw dependencyError();
  }
  if (principal === null)
    throw new UploadAdmissionError(
      'UNAUTHENTICATED',
      401,
      'Authentication is required.',
    );
  try {
    validatePrincipal(principal);
  } catch {
    // A resolver is an untrusted runtime dependency. A malformed principal
    // must never be interpreted as an authorization decision or reach either
    // signing or canonical persistence.
    throw dependencyError();
  }
  return principal;
};

/** BE00 step 7: operator prerequisites, quota, then target authorization. */
export const authorizeUploadIntent = async (
  options: UploadIntentHandlerOptions,
  parsed: Readonly<{
    policy: UploadTargetPolicy;
    request: UploadIntentRequest;
  }>,
  principal: UploadPrincipal,
  signal: AbortSignal,
): Promise<void> => {
  if (
    principal.kind === 'operator' &&
    (!principal.stepUpVerified ||
      principal.reason === null ||
      principal.reason.length === 0 ||
      !principal.capabilities.includes('upload.create') ||
      principal.capabilities.length === 0)
  )
    throw authorityError();
  if (options.rateLimit === undefined) throw dependencyError();
  let rate: UploadRateDecision;
  try {
    assertDeadlineActive(signal);
    rate = await options.rateLimit(principal, signal);
    assertDeadlineActive(signal);
  } catch {
    throw dependencyError();
  }
  if (!isUploadRateDecision(rate)) throw dependencyError();
  if (!rate.allowed) throw rateLimited(rate);
  let authorization: TargetAuthorization;
  try {
    assertDeadlineActive(signal);
    authorization = await options.authorizeTarget(
      { policy: parsed.policy, principal, request: parsed.request },
      signal,
    );
    assertDeadlineActive(signal);
  } catch {
    throw dependencyError();
  }
  if (authorization === 'not_found')
    throw new UploadAdmissionError(
      'NOT_FOUND',
      404,
      'The requested upload target was not found.',
    );
  if (authorization === 'forbidden' || authorization === 'step_up_required')
    throw authorityError();
  if (authorization !== 'allow') throw dependencyError();
};

export const commitUploadIntent = async (
  options: UploadIntentHandlerOptions,
  principal: UploadPrincipal,
  parsed: Readonly<{
    policy: UploadTargetPolicy;
    request: UploadIntentRequest;
  }>,
  ifMatch: string | null,
  idempotencyKey: string,
  requestId: ReturnType<typeof createRequestId>,
  signal: AbortSignal,
): Promise<Response> => {
  const storage = options.storage;
  if (
    storage === undefined ||
    (options.environment === 'production' &&
      (options.repository.cancelIntent === undefined ||
        storage.revoke === undefined))
  )
    throw dependencyError();
  assertDeadlineActive(signal);
  const objectId = (options.randomUUID ?? (() => crypto.randomUUID()))();
  const objectKey = generateServerObjectKey(objectId);
  const expiresAt = new Date(
    (options.now ?? Date.now)() + MAX_UPLOAD_INTENT_TTL_MS,
  ).toISOString();
  const storageInput = {
    actorId: principal.actorId,
    allowedMediaTypes: parsed.policy.allowedMediaTypes,
    expiresAt,
    maxBytes: parsed.policy.maxBytes,
    objectId,
    objectKey,
    targetId: parsed.request.targetId,
  } as const;
  let signedUpload: SignedUpload;
  let validatedSignedUpload: SignedUpload | undefined;
  let rawSignedUpload: unknown;
  try {
    rawSignedUpload = await storage.sign(storageInput, signal);
    const signed = validateSignedUpload(
      rawSignedUpload,
      storageInput,
      options.environment !== 'production',
    );
    validatedSignedUpload = signed;
    if (!signedUrlBindsGeneratedObject(signed.signedUrl, objectId, objectKey))
      throw new StorageDependencyUnavailableError();
    if (signal.aborted) throw new StorageDependencyUnavailableError();
    signedUpload = signed;
  } catch {
    const cleanupCandidate =
      validatedSignedUpload ??
      salvageSignedUploadForRevocation(
        rawSignedUpload,
        storageInput,
        options.environment !== 'production',
      );
    if (cleanupCandidate !== null && cleanupCandidate !== undefined)
      await cleanupSignedUpload(storage, cleanupCandidate, 1_000);
    throw new StorageDependencyUnavailableError();
  }
  let result: UploadIntentCreateResult;
  let malformedResult = false;
  let recoveryPromise: Promise<void> | undefined;
  const cancellationInput = {
    actorId: principal.actorId,
    objectId,
    objectKey,
    signedUpload,
    targetId: parsed.request.targetId,
    targetType: parsed.request.targetType,
  } as const;
  const recoverAttempt = (): Promise<void> => {
    if (recoveryPromise !== undefined) return recoveryPromise;
    recoveryPromise = Promise.allSettled([
      cancelCanonicalIntent(options.repository, cancellationInput),
      cleanupSignedUpload(storage, signedUpload, 1_000),
    ]).then(() => undefined);
    return recoveryPromise;
  };
  try {
    const canonical = JSON.stringify({
      actingPartyId: principal.actingPartyId,
      actorId: principal.actorId,
      byteSize: parsed.request.byteSize,
      checksum: parsed.request.checksum,
      ifMatch,
      mediaType: parsed.request.mediaType,
      operation: OPERATION,
      purpose: parsed.request.purpose,
      targetId: parsed.request.targetId,
      targetType: parsed.request.targetType,
    });
    const [idempotencyKeyHash, requestHash] = await Promise.all([
      digest(idempotencyKey),
      digest(canonical),
    ]);
    assertDeadlineActive(signal);
    const commitInput = {
      actorId: principal.actorId,
      actingPartyId: principal.actingPartyId,
      byteSize: parsed.request.byteSize,
      checksum: parsed.request.checksum,
      idempotencyKeyHash,
      ifMatch,
      mediaType: parsed.request.mediaType,
      objectId,
      objectKey,
      purpose: parsed.request.purpose,
      requestHash,
      signedUpload,
      targetId: parsed.request.targetId,
      targetType: parsed.request.targetType,
    };
    markCommitStarted(signal, recoverAttempt);
    const candidate: unknown = await options.repository.createIntent(
      commitInput,
      signal,
    );
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate) ||
      !('kind' in candidate) ||
      (candidate.kind !== 'created' &&
        candidate.kind !== 'replay' &&
        candidate.kind !== 'conflict') ||
      ((candidate.kind === 'created' || candidate.kind === 'replay') &&
        !('resource' in candidate))
    ) {
      malformedResult = true;
      throw new UploadAdmissionError(
        'INTERNAL_ERROR',
        500,
        'The upload-intent response was invalid.',
      );
    }
    result = candidate as UploadIntentCreateResult;
  } catch (error) {
    if (signal.aborted || malformedResult) await recoverAttempt();
    else await cleanupSignedUpload(storage, signedUpload, 1_000);
    throw error;
  }
  if (signal.aborted) {
    await recoverAttempt();
    throw new StorageDependencyUnavailableError();
  }
  if (result.kind === 'conflict') {
    await cleanupSignedUpload(storage, signedUpload, 1_000);
    throw new UploadAdmissionError(
      'CONFLICT',
      409,
      'The upload request conflicts with an existing operation.',
    );
  }
  let resource: UploadIntentResource;
  try {
    resource = validateResource(
      result.resource,
      result.kind === 'created'
        ? { objectId, objectKey, signedUpload }
        : undefined,
    );
  } catch (error) {
    if (result.kind === 'created') await recoverAttempt();
    else await cleanupSignedUpload(storage, signedUpload, 1_000);
    throw error;
  }
  if (result.kind === 'replay')
    await cleanupSignedUpload(storage, signedUpload, 1_000);
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json',
    etag: `"${resource.object.version}"`,
    location: `/api/v1/upload-intents/${resource.id}`,
    'x-request-id': requestId,
  });
  return new Response(JSON.stringify(resource), { headers, status: 201 });
};
