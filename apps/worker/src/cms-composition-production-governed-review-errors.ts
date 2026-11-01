import {
  CanonicalDomainSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import {
  isRecord,
  mapCmsEditorialRpcFailure,
  codeFromRpcError,
} from './cms-editorial-production-errors';
import { violationsFromDetailText } from './cms-editorial-production-error-details';
import { SERIALIZATION_TOKENS } from './cms-editorial-production-error-tokens';
import { carriesProductToken } from './cms-composition/provider-fault-guard';
import {
  governedTimeDetails,
  isGovernedTimeReason,
} from './cms-composition/governed-activation-time-details';
import {
  failure,
  type GovernedOperation,
} from './cms-composition/governed-review-ports';

const MAX_DETAIL_TEXT = 16_384;

/** The machine JSON DETAIL of a refusal as a record; anything else is no members at all. */
const detailRecord = (detail: unknown): Readonly<Record<string, unknown>> => {
  if (typeof detail !== 'string' || detail.length > MAX_DETAIL_TEXT) return {};
  try {
    const parsed = JSON.parse(detail) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** `canonical_source_unavailable` names its domain in a machine JSON DETAIL (BE03c 1375). */
const canonicalDomain = (detail: unknown): string | undefined => {
  const domain = CanonicalDomainSchema.safeParse(detailRecord(detail).domain);
  return domain.success ? domain.data : undefined;
};

/** Named tokens only: prose and supplied details never select a refusal. */
export const governedRpcError = (
  operation: GovernedOperation,
  status: number,
  payload: unknown,
) => {
  if (
    isRecord(payload) &&
    payload.code === '40001' &&
    SERIALIZATION_TOKENS.has(codeFromRpcError(payload))
  )
    return mapCmsEditorialRpcFailure(status, payload);
  if (
    isRecord(payload) &&
    (payload.code === 'INTERNAL_ERROR' ||
      (payload.code === 'P0001' && payload.message === 'INTERNAL_ERROR'))
  )
    return failure(500);
  if (status >= 500) return failure(503, {}, 15);
  const reason = CmsSlice12ReasonCodeSchema.safeParse(
    isRecord(payload) && payload.code === 'P0001' ? payload.message : undefined,
  );
  if (reason.success) {
    if (
      !(
        CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]
      ).includes(reason.data)
    )
      return failure(500);
    // A reason token is only parsed from a record whose `code` is P0001, so `payload` is a record here.
    const detail = (payload as Readonly<Record<string, unknown>>).details;
    if (reason.data === 'expiry_out_of_bounds')
      // The member the bound applies to travels as a JSON pointer array DETAIL.
      return failure(cmsSlice12ReasonStatus(reason.data), {
        reasonCode: reason.data,
        violations: violationsFromDetailText(detail, undefined),
      });
    if (isGovernedTimeReason(reason.data)) {
      // The members of a time refusal (pinned version, expected instant, horizon, alternatives) are
      // mandatory: a refusal without them is an invalid dependency answer, 502 (BE00 592).
      const members = governedTimeDetails(
        reason.data,
        detailRecord(detail),
        new Set(),
      );
      return members === null
        ? failure(502)
        : failure(cmsSlice12ReasonStatus(reason.data), members);
    }
    if (reason.data !== 'canonical_source_unavailable')
      return failure(cmsSlice12ReasonStatus(reason.data), {
        reasonCode: reason.data,
      });
    // `domain` is mandatory (BE03c 1375; refusals.ts): a refusal without a valid
    // one is an invalid dependency answer, 502 (BE00 592), never a bare 422.
    const domain = canonicalDomain(detail);
    return domain === undefined
      ? failure(502)
      : failure(cmsSlice12ReasonStatus(reason.data), {
          reasonCode: reason.data,
          domain,
        });
  }
  // A 4xx that carries no product token is a provider fault, not a refusal (BE03c 1298-1302).
  if (!carriesProductToken(payload)) return failure(500);
  const result = mapCmsEditorialRpcFailure(status, payload);
  // Reasons from another editorial domain cannot cross this operation boundary.
  if (result.details?.reasonCode !== undefined) return failure(500);
  return result;
};

/**
 * The committed refusals each operation answers (governed-a/-b RPC boundary). CMS-03C-07 commits
 * `dependency_changed` and `review_not_open` (BE03c 1262: both are on its row); CMS-03C-09 commits
 * only `dependency_changed` for every invalidation (BE03c 1262, 1326 step 4), whatever the stored
 * review reason.
 */
const COMMITTED_REASONS: Readonly<Record<string, ReadonlySet<string>>> = {
  'CMS-03C-07': new Set(['dependency_changed', 'review_not_open']),
  'CMS-03C-09': new Set(['dependency_changed']),
};
const COMMITTED_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'reasonCode',
  'details',
]);

/**
 * A decision whose invalidation committed cannot raise (an exception would roll the
 * invalidation back), so the RPC answers `{ kind: 'refusal', reasonCode, details }` on
 * HTTP 200, stored and replayed as a 409. `null`: not an envelope. Anything shaped like
 * one but not exactly that, or naming a reason the operation does not commit, is an invalid
 * dependency answer (502), never a caller refusal.
 */
export const committedRefusal = (
  operation: GovernedOperation,
  value: unknown,
) => {
  if (!isRecord(value) || value.kind !== 'refusal') return null;
  const valid =
    typeof value.reasonCode === 'string' &&
    COMMITTED_REASONS[operation]?.has(value.reasonCode) === true &&
    Object.keys(value).every((key) => COMMITTED_KEYS.has(key)) &&
    (value.details === undefined || isRecord(value.details));
  return valid ? failure(409, { reasonCode: value.reasonCode }) : failure(502);
};
