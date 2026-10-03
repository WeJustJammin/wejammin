import {
  DEFAULT_DEPENDENCY_CLASS,
  boundedRateLimit,
  boundedRetryAfterSeconds,
  registeredDependencyClass,
  registeredReasonCode,
  withinDetailsCeiling,
} from './error-detail-values';
import type { ContentSchemaRegistryError } from './types';

/**
 * BE03a error matrix: a 409 may carry `expectedVersion` and `currentVersion`
 * and nothing else. A 400 or 422 never carries them; `reason` is never on the
 * wire for any status.
 */
const VERSION_DETAIL = /^[1-9][0-9]{0,18}$/u;

const safeVersionDetails = (
  details: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    ['expectedVersion', 'currentVersion'].flatMap((key) => {
      const value = details[key];
      return typeof value === 'string' && VERSION_DETAIL.test(value)
        ? [[key, value]]
        : [];
    }),
  );

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

const STEP_UP_METHOD_MAX_LENGTH = 32;
const STEP_UP_METHOD_MAX_COUNT = 8;
const safeStepUpMethod = /^[a-z][a-z0-9_]{0,31}$/u;

/**
 * BE00 allows only configured step-up method identifiers on the wire. Keep
 * bounded identifiers, drop everything else, and never let an unconfigured or
 * malformed list invent a method. A non-array list fails closed.
 */
const safeStepUpMethods = (value: unknown): readonly string[] | null => {
  if (!Array.isArray(value)) return null;
  const methods = value.filter(
    (method): method is string =>
      typeof method === 'string' &&
      method.length <= STEP_UP_METHOD_MAX_LENGTH &&
      safeStepUpMethod.test(method),
  );
  return [...new Set(methods)].slice(0, STEP_UP_METHOD_MAX_COUNT);
};

/**
 * Keep only bounded error details that are useful to a human client. Every
 * value is checked against its registered set or bound, and the serialized
 * result is held to the BE00 ceiling at this final wire boundary.
 */
export const safeDetails = (
  result: ContentSchemaRegistryError,
): Readonly<Record<string, unknown>> =>
  withinDetailsCeiling(registeredDetails(result));

const registeredDetails = (
  result: ContentSchemaRegistryError,
): Readonly<Record<string, unknown>> => {
  if (result.status === 404 || result.status === 500) return {};
  if (result.status === 400 || result.status === 422) {
    const details = result.details ?? {};
    const violations = details.violations;
    const safeViolations = Array.isArray(violations)
      ? violations.flatMap((value) => {
          if (typeof value !== 'object' || value === null) return [];
          const candidate = value as Record<string, unknown>;
          const pointer =
            typeof candidate.pointer === 'string' &&
            candidate.pointer.length <= 256 &&
            /^[\x20-\x7e]+$/u.test(candidate.pointer)
              ? candidate.pointer
              : null;
          const message =
            typeof candidate.message === 'string' &&
            candidate.message.length <= 500 &&
            /^[\x20-\x7e]+$/u.test(candidate.message)
              ? candidate.message
              : null;
          const code =
            typeof candidate.code === 'string' &&
            candidate.code.length <= 64 &&
            /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(candidate.code)
              ? candidate.code
              : null;
          return pointer === null && message === null && code === null
            ? []
            : [
                {
                  ...(pointer === null ? {} : { pointer }),
                  ...(message === null ? {} : { message }),
                  ...(code === null ? {} : { code }),
                },
              ];
        })
      : [];
    return safeViolations.length === 0
      ? {}
      : { violations: safeViolations.slice(0, 50) };
  }
  if (result.status === 401) {
    if (result.code === 'STEP_UP_REQUIRED') {
      if (result.details?.recoveryAction !== 'step_up') return {};
      const allowedMethods = safeStepUpMethods(result.details.allowedMethods);
      return allowedMethods === null
        ? {}
        : { recoveryAction: 'step_up', allowedMethods: [...allowedMethods] };
    }
    return result.details?.recoveryAction === 'reauthenticate'
      ? { recoveryAction: 'reauthenticate' }
      : {};
  }
  if (result.status === 403) {
    const reasonCode = registeredReasonCode(result.details?.reasonCode);
    return reasonCode === null ? {} : { reasonCode };
  }
  if (result.status === 409) return safeVersionDetails(result.details ?? {});
  if (result.status === 429) {
    const details = result.details ?? {};
    // BE00 RATE_LIMITED: { retryAfterSeconds: number, limit: number,
    // resetAt: string }. `resetAt` is an RFC 3339 UTC instant, never a number.
    const retryAfterSeconds = boundedRetryAfterSeconds(
      details.retryAfterSeconds,
    );
    const limit = boundedRateLimit(details.limit);
    return {
      ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
      ...(limit === null ? {} : { limit }),
      ...(typeof details.resetAt === 'string' &&
      RFC3339_UTC.test(details.resetAt)
        ? { resetAt: details.resetAt }
        : {}),
    };
  }
  if (result.status === 502 || result.status === 503 || result.status === 504) {
    const details = result.details ?? {};
    const retryAfterSeconds = boundedRetryAfterSeconds(
      result.retryAfterSeconds,
    );
    return {
      dependencyClass:
        registeredDependencyClass(details.dependencyClass) ??
        DEFAULT_DEPENDENCY_CLASS,
      retryable: true,
      ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
    };
  }
  return {};
};
