import { ApiErrorSchema } from '@wejammin/contracts';

import {
  ERROR_CODES,
  statusOf,
  type CmsTemplateDependencies,
  type CmsTemplateError,
  type Status,
} from './template-shared';

const VIOLATION_CODES = new Set([
  'template_key_invalid',
  'slot_key_invalid',
  'block_reference_duplicate',
  'protected_region_position_invalid',
  'reserved_region_duplicate',
  'audience_invalid',
  'compatible_type_duplicate',
  'template_slot_duplicate',
]);

/** Detail projection never forwards SQL/provider prose, resource names, or content. */
const safeDetails = (
  status: Status,
  source: unknown,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return {};
  const details = source as Readonly<Record<string, unknown>>;
  if (status === 400 || status === 422) {
    if (!Array.isArray(details.violations)) return {};
    return {
      violations: details.violations.slice(0, 50).flatMap((candidate) => {
        if (
          typeof candidate !== 'object' ||
          candidate === null ||
          Array.isArray(candidate)
        )
          return [];
        const value = candidate as Readonly<Record<string, unknown>>;
        return [
          {
            path:
              typeof value.path === 'string' ? value.path.slice(0, 256) : '/',
            code:
              typeof value.code === 'string' && VIOLATION_CODES.has(value.code)
                ? value.code
                : 'invalid',
            message: 'The value is invalid.',
          },
        ];
      }),
    };
  }
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
    return output;
  }
  if (status === 429) {
    const output: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const)
      if (key === 'resetAt') {
        if (typeof details[key] === 'string' && /^\d+$/u.test(details[key]))
          output[key] = details[key];
      } else if (
        typeof details[key] === 'number' &&
        Number.isSafeInteger(details[key]) &&
        details[key] >= 0
      )
        output[key] = details[key];
    return output;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

export const commonHeaders = (
  request: Request,
  dependencies: CmsTemplateDependencies,
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
  dependencies: CmsTemplateDependencies,
  requestId: string,
  error: CmsTemplateError,
  additionalHeaders?: Headers,
): Response => {
  const status = statusOf(error.status);
  const code = ERROR_CODES[status];
  const details = safeDetails(status, error.details);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  const retryAfter = error.retryAfterSeconds;
  if (
    (status === 429 || status === 503 || status === 504) &&
    typeof retryAfter === 'number' &&
    Number.isSafeInteger(retryAfter) &&
    retryAfter > 0
  )
    headers.set('retry-after', String(retryAfter));
  additionalHeaders?.forEach((value, name) => headers.set(name, value));
  if (status === 429) {
    if (typeof details.limit === 'number')
      headers.set('ratelimit-limit', String(details.limit));
    if (typeof details.resetAt === 'string')
      headers.set('ratelimit-reset', details.resetAt);
    headers.set('ratelimit-remaining', '0');
  }
  const payload = ApiErrorSchema.parse({
    code,
    message: `${code}: template operation rejected or unavailable.`,
    requestId,
    details,
  });
  return new Response(JSON.stringify(payload), { status, headers });
};
