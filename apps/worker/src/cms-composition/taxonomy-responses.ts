import { mediaTypeDetails } from './media-type-details';
import { ApiErrorSchema } from '@wejammin/contracts';

import {
  ERROR_CODES,
  statusOf,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
  type Status,
} from './taxonomy-contracts';

/** Shared BE00 detail allowlist for human composition mutations. */
export const safeDetails = (
  status: Status,
  source: unknown,
): Readonly<Record<string, unknown>> => {
  if (status === 415) return mediaTypeDetails(source);
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return {};
  const details = source as Readonly<Record<string, unknown>>;
  if (status === 400 || status === 422) {
    const raw = details.violations;
    if (!Array.isArray(raw)) return {};
    const violations = raw.slice(0, 16).flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item))
        return [];
      const record = item as Readonly<Record<string, unknown>>;
      if (
        typeof record.path !== 'string' ||
        record.path.length > 256 ||
        !/^\/[A-Za-z0-9_~/-]*$/u.test(record.path) ||
        typeof record.code !== 'string' ||
        !/^[a-z][a-z0-9_]{0,63}$/u.test(record.code)
      )
        return [];
      return [
        {
          path: record.path,
          code: record.code,
          message: 'The value is invalid.',
        },
      ];
    });
    return violations.length > 0 ? { violations } : {};
  }
  if (status === 403)
    return details.reasonCode === 'CAPABILITY_REQUIRED'
      ? { reasonCode: 'CAPABILITY_REQUIRED' }
      : {};
  if (status === 409) {
    const result: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (
        typeof details[key] === 'string' &&
        /^[1-9]\d{0,18}$/u.test(details[key])
      )
        result[key] = details[key];
    return result;
  }
  if (status === 429) {
    const result: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit'] as const)
      if (
        typeof details[key] === 'number' &&
        Number.isSafeInteger(details[key]) &&
        details[key] >= 0
      )
        result[key] = details[key];
    if (
      typeof details.resetAt === 'string' &&
      /^\d{1,13}$/u.test(details.resetAt)
    )
      result.resetAt = details.resetAt;
    return result;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

export const commonHeaders = (
  request: Request,
  dependencies: CmsTaxonomyDependencies,
  requestId: string,
): Headers => {
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  const origin = request.headers.get('origin');
  if (origin !== null && dependencies.humanOrigins.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
};

export const errorResponse = (
  request: Request,
  dependencies: CmsTaxonomyDependencies,
  requestId: string,
  error: CmsTaxonomyError,
  extra?: Headers,
): Response => {
  const status = statusOf(error.status);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (
    (status === 429 || status === 503 || status === 504) &&
    typeof error.retryAfterSeconds === 'number' &&
    Number.isSafeInteger(error.retryAfterSeconds) &&
    error.retryAfterSeconds > 0
  )
    headers.set('retry-after', String(error.retryAfterSeconds));
  extra?.forEach((value, key) => headers.set(key, value));
  const code = ERROR_CODES[status];
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: `${code}: taxonomy operation rejected or unavailable.`,
        requestId,
        details: safeDetails(status, error.details),
      }),
    ),
    { status, headers },
  );
};
