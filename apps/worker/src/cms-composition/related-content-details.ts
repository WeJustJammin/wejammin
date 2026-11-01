import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import { mediaTypeDetails } from './media-type-details';
import type { CmsRelatedContentStatus } from './related-content-types';

/**
 * BE03c 1304: a refusal carries exactly one lowercase reason token from the closed Slice 12 list, on the one
 * status that list gives it, and only if CMS-03C-05 may raise it. Anything else is dropped, never repaired.
 */
const typedReason = (
  status: CmsRelatedContentStatus,
  details: Readonly<Record<string, unknown>>,
): string | null => {
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(details.reasonCode);
  return parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === status &&
    (
      CMS_SLICE_12_OPERATION_REASONS['CMS-03C-05'] as readonly string[]
    ).includes(parsed.data)
    ? parsed.data
    : null;
};

export const safeDetails = (
  status: CmsRelatedContentStatus,
  source: unknown,
): Readonly<Record<string, unknown>> => {
  if (status === 415) return mediaTypeDetails(source);
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return {};
  const details = source as Readonly<Record<string, unknown>>;
  if (status === 400 || status === 422) {
    const reason = status === 422 ? typedReason(status, details) : null;
    const raw = details.violations;
    if (!Array.isArray(raw))
      return reason === null ? {} : { reasonCode: reason };
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
    return {
      ...(reason === null ? {} : { reasonCode: reason }),
      ...(violations.length > 0 ? { violations } : {}),
    };
  }
  if (status === 403) {
    const reason = typedReason(status, details);
    return reason === null ? {} : { reasonCode: reason };
  }
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
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const)
      if (
        typeof details[key] === 'number' &&
        Number.isSafeInteger(details[key]) &&
        details[key] >= 0
      )
        result[key] = details[key];
    return result;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: true };
  return {};
};
