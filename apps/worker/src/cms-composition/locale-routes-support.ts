import { mediaTypeDetails } from './media-type-details';
import type {
  LocaleVariantRequest,
  LocaleVariantResource,
} from '@wejammin/contracts';
import {
  LocaleFallbackChainMismatchDetailsSchema,
  LocaleVariantResourceSchema,
} from '@wejammin/contracts';

import type {
  CmsLocaleError,
  CmsLocaleRateDecision,
  CmsLocaleResult,
  CmsLocaleStatus,
} from './locale-routes-types';

export const ERROR_CODES: Readonly<Record<CmsLocaleStatus, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'LOCALE_FORBIDDEN',
  404: 'LOCALE_SOURCE_NOT_FOUND',
  409: 'LOCALE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'LOCALE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
};

export const statusOf = (value: number): CmsLocaleStatus =>
  Object.hasOwn(ERROR_CODES, value) ? (value as CmsLocaleStatus) : 500;

export const failure = (
  status: CmsLocaleStatus,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsLocaleError => ({
  ok: false,
  status,
  code: ERROR_CODES[status],
  message: `${ERROR_CODES[status]}: locale operation rejected or unavailable.`,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

export const validEnvelope = <T>(value: unknown): value is CmsLocaleResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'ok' in value &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? 'value' in value
    : 'status' in value && typeof value.status === 'number');

export const safeDetails = (
  status: CmsLocaleStatus,
  source: unknown,
): Record<string, unknown> => {
  if (status === 415) return mediaTypeDetails(source);
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return {};
  const details = source as Readonly<Record<string, unknown>>;
  if (status === 403)
    return details.reasonCode === 'CAPABILITY_REQUIRED'
      ? { reasonCode: 'CAPABILITY_REQUIRED' }
      : {};
  if (status === 409) {
    const output: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (
        typeof details[key] === 'string' &&
        /^[1-9]\d{0,18}$/u.test(details[key])
      )
        output[key] = details[key];
    // OD-4: only a well-formed, bounded active chain may accompany the reason.
    const mismatch = LocaleFallbackChainMismatchDetailsSchema.safeParse({
      reasonCode: details.reasonCode,
      activeFallbackChain: details.activeFallbackChain,
    });
    if (mismatch.success) {
      output.reasonCode = mismatch.data.reasonCode;
      output.activeFallbackChain = [...mismatch.data.activeFallbackChain];
    }
    return output;
  }
  if (status === 429) {
    const output: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit'] as const)
      if (
        typeof details[key] === 'number' &&
        Number.isSafeInteger(details[key]) &&
        details[key] >= 0
      )
        output[key] = details[key];
    if (
      typeof details.resetAt === 'string' &&
      /^\d{1,13}$/u.test(details.resetAt)
    )
      output.resetAt = details.resetAt;
    return output;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

export const validRate = (
  rate: unknown,
  limit: 60 | 120,
): rate is CmsLocaleRateDecision =>
  typeof rate === 'object' &&
  rate !== null &&
  !Array.isArray(rate) &&
  'allowed' in rate &&
  typeof rate.allowed === 'boolean' &&
  'limit' in rate &&
  rate.limit === limit &&
  'remaining' in rate &&
  typeof rate.remaining === 'number' &&
  Number.isSafeInteger(rate.remaining) &&
  rate.remaining >= 0 &&
  rate.remaining <= limit &&
  'resetAt' in rate &&
  typeof rate.resetAt === 'number' &&
  Number.isSafeInteger(rate.resetAt) &&
  rate.resetAt >= 0;

export const validDraft = (
  value: unknown,
  body: LocaleVariantRequest,
): value is LocaleVariantResource => {
  const parsed = LocaleVariantResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const resource = parsed.data;
  return (
    resource.state === 'draft' &&
    resource.entryId === body.entryId &&
    resource.locale === body.locale &&
    resource.sourceRevisionId === body.sourceRevisionId &&
    resource.fallbackChain.join('\u0000') ===
      body.fallbackChain.join('\u0000') &&
    resource.noFallbackFieldIds.join('\u0000') ===
      body.noFallbackFieldIds.join('\u0000')
  );
};
