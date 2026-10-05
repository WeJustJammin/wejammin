import { JobStatusTransportSchema } from '@wejammin/contracts';

import {
  JOB_STATUS_TIMEOUT_MS,
  PARTY_READ_LIMIT,
  USER_READ_LIMIT,
  type JobRateLimitDecision,
  type JobRateLimitInput,
  type JobStatusDependencies,
  JobStatusInternalError,
  type JobStatusRecord,
} from './job-status-types';
import { verifyReadOrigin } from '../authentication/boundary';
import { authorizeJobStatus, currentTimeMs } from './job-status-access';
import {
  dependencyError,
  forbiddenOriginError,
  internalError,
  isUuid,
  notFoundError,
  parseJobPath,
  parsePrincipal,
  parseRateDecision,
  rateLimitedError,
  unauthenticatedError,
  type JobReadResult,
} from './job-status-support';

export type JobStatusRateLimiter = (
  input: JobRateLimitInput,
) => JobRateLimitDecision | Promise<JobRateLimitDecision>;

export const DEADLINE = Symbol('job-status-deadline');

export const runWithDeadline = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T | typeof DEADLINE> => {
  const controller = new AbortController();
  let resolveDeadline!: (value: typeof DEADLINE) => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {
    resolveDeadline = resolve;
  });
  const timer = setTimeout(() => {
    resolveDeadline(DEADLINE);
    controller.abort();
  }, JOB_STATUS_TIMEOUT_MS);
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const readJobStatus = async (
  request: Request,
  requestId: string,
  dependencies: JobStatusDependencies,
  rateLimiter: JobStatusRateLimiter,
  signal: AbortSignal = new AbortController().signal,
): Promise<JobReadResult> => {
  // BE00 step 2: a read has no body, content type or CSRF token; the origin
  // check is the transport gate. Step 6 (strict path and query) runs after the
  // session, so an unauthenticated caller learns nothing about path shapes.
  if (verifyReadOrigin(request) !== null) {
    return { error: forbiddenOriginError(), kind: 'error' };
  }

  let principalValue: unknown;
  try {
    principalValue = await dependencies.resolvePrincipal(request, signal);
  } catch {
    return { error: dependencyError(), kind: 'error' };
  }
  const principal = parsePrincipal(principalValue);
  if (principal === 'invalid') return { error: internalError(), kind: 'error' };
  if (principal === null || principal.kind === 'anonymous') {
    return { error: unauthenticatedError(), kind: 'error' };
  }
  if (
    principal.kind === 'queue' ||
    principal.kind === 'webhook' ||
    principal.kind === 'deployment' ||
    principal.kind === 'service'
  ) {
    return { error: notFoundError(), kind: 'error' };
  }

  const path = parseJobPath(request);
  if ('code' in path) return { error: path, kind: 'error' };

  let nowMs: number;
  try {
    nowMs = currentTimeMs(dependencies);
  } catch {
    return { error: dependencyError(), kind: 'error' };
  }

  let decision: JobRateLimitDecision;
  try {
    const result = await rateLimiter({
      actingPartyId:
        principal.kind === 'acting_party' || principal.kind === 'operator'
          ? principal.actingPartyId
          : null,
      nowMs,
      partyLimit: PARTY_READ_LIMIT,
      signal,
      userId: principal.userId,
      userLimit: USER_READ_LIMIT,
    });
    const parsed = parseRateDecision(result);
    if (parsed === null) return { error: internalError(), kind: 'error' };
    decision = parsed;
  } catch {
    return { error: dependencyError(), kind: 'error' };
  }
  if (!decision.allowed) {
    return { error: rateLimitedError(decision, nowMs), kind: 'error' };
  }

  let loaded: JobStatusRecord | null;
  try {
    loaded = await dependencies.loadJobStatus({
      jobId: path.jobId,
      signal,
    });
  } catch (error) {
    return {
      error:
        error instanceof JobStatusInternalError
          ? internalError()
          : dependencyError(),
      kind: 'error',
    };
  }
  if (loaded === null) return { error: notFoundError(), kind: 'error' };

  const parsed = JobStatusTransportSchema.safeParse({
    data: loaded.data,
    etag: loaded.etag,
  });
  if (
    !parsed.success ||
    !isUuid(loaded.actorId) ||
    (loaded.actingPartyId !== null && !isUuid(loaded.actingPartyId)) ||
    parsed.data.data.id !== path.jobId
  ) {
    return { error: internalError(), kind: 'error' };
  }

  const authorizationError = await authorizeJobStatus(
    dependencies,
    principal,
    loaded,
    path.jobId,
    requestId,
    signal,
  );
  if (authorizationError !== null) {
    return { error: authorizationError, kind: 'error' };
  }

  return {
    kind: 'success',
    notModified: request.headers.get('if-none-match') === loaded.etag,
    record: loaded,
  };
};
