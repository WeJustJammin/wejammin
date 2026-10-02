import {
  ApiErrorSchema,
  CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
  CmsStepUpRequiredDetailsSchema,
} from '@wejammin/contracts';
import type { ApiError, JsonValue } from '@wejammin/contracts';

export interface ContentSchemaRegistryErrorMetadata {
  readonly apiError: ApiError | null;
  readonly retryable: boolean | null;
  readonly retryAfterSeconds: number | null;
  readonly etag: string | null;
}

const MAX_RETRY_AFTER_SECONDS = 3_600;

const boundedText = (value: unknown, maximum: number): string | null =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maximum &&
  /^[\x20-\x7e]+$/u.test(value)
    ? value
    : null;

const boundedNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const safeViolation = (value: JsonValue): JsonValue | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const object = value as { readonly [key: string]: JsonValue };
  const pointer = boundedText(object.pointer, 256);
  const message = boundedText(object.message, 500);
  const code = boundedText(object.code, 64);
  if (pointer === null && message === null && code === null) return null;
  return {
    ...(pointer === null ? {} : { pointer }),
    ...(message === null ? {} : { message }),
    ...(code === null ? {} : { code }),
  };
};

const safeTextFields = (
  details: Readonly<Record<string, JsonValue>>,
  keys: readonly string[],
): Readonly<Record<string, JsonValue>> =>
  Object.fromEntries(
    keys.flatMap((key) => {
      const value = boundedText(details[key], 256);
      return value === null ? [] : [[key, value]];
    }),
  );

/**
 * BE03a 401 `STEP_UP_REQUIRED`: only the exact recovery action and the
 * allowlisted method identifiers cross the boundary. Anything else, including
 * a malformed method list, collapses to no details so the browser falls back
 * to plain re-authentication rather than a step-up route it cannot verify.
 */
const safeStepUpDetails = (
  details: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> => {
  const parsed = CmsStepUpRequiredDetailsSchema.safeParse({
    recoveryAction: details.recoveryAction,
    allowedMethods: details.allowedMethods,
  });
  return parsed.success
    ? {
        recoveryAction: parsed.data.recoveryAction,
        allowedMethods: [...parsed.data.allowedMethods],
      }
    : {};
};

const safeDetails = (
  status: number,
  details: Readonly<Record<string, JsonValue>>,
  code: string,
): Readonly<Record<string, JsonValue>> => {
  if (status === 400 || status === 422) {
    const violations = Array.isArray(details.violations)
      ? details.violations
          .map(safeViolation)
          .filter((value): value is JsonValue => value !== null)
          .slice(0, 50)
      : [];
    return {
      ...safeTextFields(details, [
        'expectedVersion',
        'currentVersion',
        'reason',
      ]),
      ...(violations.length === 0 ? {} : { violations }),
    };
  }
  if (status === 401) {
    if (code === 'STEP_UP_REQUIRED') return safeStepUpDetails(details);
    return details.recoveryAction === 'reauthenticate'
      ? { recoveryAction: 'reauthenticate' }
      : {};
  }
  if (status === 403) {
    const reasonCode = boundedText(details.reasonCode, 128);
    return reasonCode === null ? {} : { reasonCode };
  }
  if (status === 409) {
    return safeTextFields(details, [
      'expectedVersion',
      'currentVersion',
      'reason',
    ]);
  }
  if (status === 429) {
    const values = ['limit', 'resetAt', 'retryAfterSeconds'] as const;
    return Object.fromEntries(
      values.flatMap((key) => {
        const value = boundedNumber(details[key]);
        return value === null ? [] : [[key, value]];
      }),
    );
  }
  if (status === 502 || status === 503 || status === 504) {
    const dependencyClass = boundedText(details.dependencyClass, 128);
    const retryable =
      typeof details.retryable === 'boolean' ? details.retryable : null;
    const retryAfterSeconds = boundedNumber(details.retryAfterSeconds);
    return {
      ...(dependencyClass === null ? {} : { dependencyClass }),
      ...(retryable === null ? {} : { retryable }),
      ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
    };
  }
  return {};
};

const parseRetryAfter = (value: string | null): number | null => {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed))
    return Math.min(MAX_RETRY_AFTER_SECONDS, Number(trimmed));
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp)
    ? Math.min(
        MAX_RETRY_AFTER_SECONDS,
        Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000)),
      )
    : null;
};

const parseRetryable = (value: string | null): boolean | null =>
  value === 'true' ? true : value === 'false' ? false : null;

export const parseContentSchemaRegistryErrorMetadata = async (
  response: Response,
  status = response.status,
): Promise<ContentSchemaRegistryErrorMetadata> => {
  let apiError: ApiError | null = null;
  try {
    const parsed = ApiErrorSchema.safeParse(await response.clone().json());
    if (parsed.success)
      apiError = {
        ...parsed.data,
        details: safeDetails(status, parsed.data.details, parsed.data.code),
      };
  } catch {
    apiError = null;
  }
  const headerRetryable = parseRetryable(
    response.headers.get(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER),
  );
  const bodyRetryable =
    apiError !== null &&
    (status === 502 || status === 503 || status === 504) &&
    typeof apiError.details.retryable === 'boolean'
      ? apiError.details.retryable
      : null;
  const bodyRetryAfter =
    apiError !== null && typeof apiError.details.retryAfterSeconds === 'number'
      ? Math.min(
          MAX_RETRY_AFTER_SECONDS,
          Math.max(0, Math.ceil(apiError.details.retryAfterSeconds)),
        )
      : null;
  return {
    apiError,
    retryable: headerRetryable ?? bodyRetryable,
    retryAfterSeconds:
      parseRetryAfter(response.headers.get('retry-after')) ?? bodyRetryAfter,
    etag: response.headers.get('etag'),
  };
};
