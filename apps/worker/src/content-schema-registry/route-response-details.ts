import type { ContentSchemaRegistryError } from './types';

const safeVersionDetails = (
  details: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    ['expectedVersion', 'currentVersion', 'reason'].flatMap((key) =>
      typeof details[key] === 'string' ? [[key, details[key]]] : [],
    ),
  );

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

/** Keep only bounded error details that are useful to a human client. */
export const safeDetails = (
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
            /^[A-Z][A-Z0-9_]{0,63}$/u.test(candidate.code)
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
    return {
      ...safeVersionDetails(details),
      ...(safeViolations.length === 0
        ? {}
        : { violations: safeViolations.slice(0, 50) }),
    };
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
  if (result.status === 403)
    return typeof result.details?.reasonCode === 'string'
      ? { reasonCode: result.details.reasonCode }
      : {};
  if (result.status === 409) return safeVersionDetails(result.details ?? {});
  if (result.status === 429) {
    const details = result.details ?? {};
    return Object.fromEntries(
      ['limit', 'resetAt', 'retryAfterSeconds'].flatMap((key) =>
        typeof details[key] === 'number' ? [[key, details[key]]] : [],
      ),
    );
  }
  if (result.status === 502 || result.status === 503 || result.status === 504) {
    const details = result.details ?? {};
    return {
      ...(typeof details.dependencyClass === 'string'
        ? { dependencyClass: details.dependencyClass }
        : {}),
      ...(typeof details.retryable === 'boolean'
        ? { retryable: details.retryable }
        : {}),
      ...(typeof result.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: result.retryAfterSeconds }
        : {}),
    };
  }
  return {};
};
