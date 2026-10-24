import {
  CanonicalDomainSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsUuidSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import type { Status } from './taxonomy-contracts';
import { safeDetails } from './taxonomy-safe-details';

type Details = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Details =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * BE03c 1304: a CMS-03C-03 refusal carries exactly one lowercase reason token of its own list, on the one status that
 * token keeps, plus only the members the token names (`refusals.ts`): `canonical_overlap` the domain and the
 * canonical id, `canonical_source_unavailable` the domain. A token on another status, one this operation does not
 * publish, or one whose mandatory member is missing or invalid is dropped, never repaired.
 */
const typedReason = (status: Status, source: unknown): Details | null => {
  if (status !== 403 && status !== 409 && status !== 422) return null;
  if (!isRecord(source)) return null;
  const reason = CmsSlice12ReasonCodeSchema.safeParse(source.reasonCode);
  if (
    !reason.success ||
    cmsSlice12ReasonStatus(reason.data) !== status ||
    !(
      CMS_SLICE_12_OPERATION_REASONS['CMS-03C-03'] as readonly string[]
    ).includes(reason.data)
  )
    return null;
  if (reason.data === 'canonical_source_unavailable') {
    const domain = CanonicalDomainSchema.safeParse(source.domain);
    return domain.success
      ? { reasonCode: reason.data, domain: domain.data }
      : null;
  }
  if (reason.data === 'canonical_overlap') {
    const domain = CanonicalDomainSchema.safeParse(source.domain);
    const canonicalId = CmsUuidSchema.safeParse(source.canonicalId);
    return domain.success && canonicalId.success
      ? {
          reasonCode: reason.data,
          domain: domain.data,
          canonicalId: canonicalId.data,
        }
      : null;
  }
  return { reasonCode: reason.data };
};

/** The wire `details` of a CMS-03C-03 error: its typed reason first, else the shared BE00 allowlist (never a 403 token). */
export const taxonomyTermDetails = (
  status: Status,
  source: unknown,
): Details => {
  const typed = typedReason(status, source);
  if (typed !== null) return typed;
  return safeDetails(status, source);
};
