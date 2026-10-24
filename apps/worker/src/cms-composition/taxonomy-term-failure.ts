import { CanonicalDomainSchema, CmsUuidSchema } from '@wejammin/contracts';

import { isRecord } from '../cms-editorial-production-errors';
import {
  failure,
  type CmsTaxonomyDefinitionError,
} from './taxonomy-definition-shared';

const MAX_DETAIL_TEXT = 16_384;

/** The machine JSON DETAIL of a refusal (PostgREST `details`) as a record; anything else is no members at all. */
const detailRecord = (detail: unknown): Readonly<Record<string, unknown>> => {
  if (typeof detail !== 'string' || detail.length > MAX_DETAIL_TEXT) return {};
  try {
    const parsed = JSON.parse(detail) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * The Slice 12 typed refusals CMS-03C-03 publishes beyond `capability_missing` (BE03c 1304, 1375;
 * `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-03']`). The token is the whole PostgREST `message` of a `P0001` raise; the
 * members travel in the machine JSON DETAIL. `canonical_overlap` and `canonical_source_unavailable` carry a mandatory
 * `domain` (and the overlap its `canonicalId`): a refusal without valid ones is an invalid dependency answer, 502
 * (BE00 592), never a bare 422. `null`: not one of these tokens.
 */
export const termActionFailure = (
  token: string,
  detail: unknown,
): CmsTaxonomyDefinitionError | null => {
  if (token === 'taxonomy_not_active')
    return failure(409, { reasonCode: token });
  if (token !== 'canonical_overlap' && token !== 'canonical_source_unavailable')
    return null;
  const members = detailRecord(detail);
  const domain = CanonicalDomainSchema.safeParse(members.domain);
  if (!domain.success) return failure(502);
  if (token === 'canonical_source_unavailable')
    return failure(422, { reasonCode: token, domain: domain.data });
  const canonicalId = CmsUuidSchema.safeParse(members.canonicalId);
  return canonicalId.success
    ? failure(422, {
        reasonCode: token,
        domain: domain.data,
        canonicalId: canonicalId.data,
      })
    : failure(502);
};
