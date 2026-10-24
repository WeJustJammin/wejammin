import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import { codeFromRpcError, isRecord } from './cms-editorial-production-errors';
import { mapCmsCompositionRpcFailure } from './cms-composition-production-failure';
import { violationsFromDetailText } from './cms-editorial-production-error-details';
import { SERIALIZATION_TOKENS } from './cms-editorial-production-error-tokens';
import { carriesProductToken } from './cms-composition/provider-fault-guard';
import { failure } from './cms-composition/related-content-response';
import type { CmsRelatedContentError } from './cms-composition/related-content-types';

/** The two refusals of CMS-03C-05 that name the offending request member in a JSON pointer array DETAIL. */
const POINTER_REASONS: ReadonlySet<string> = new Set([
  'related_target_ineligible',
  'derived_rule_unknown',
]);

/**
 * CMS-03C-05 RPC failure to port refusal. Named tokens only: the whole `message` of a platform raise selects
 * the refusal, prose and supplied details never do (BE03c 1298-1304).
 *  - a Slice 12 reason token of this operation keeps its one catalog status and names itself, plus the
 *    request pointers a uniform target refusal or an unknown rule carries;
 *  - a token of another operation, an unregistered raise, or a 4xx that no platform raise produced (PostgREST
 *    `PGRST*`, a raw SQLSTATE, a non-object body) is a contract failure: a scrubbed 500;
 *  - the generic BE03b tokens (NOT_FOUND, VERSION_MISMATCH with its expected/current pair, VALIDATION_FAILED
 *    with its pointers, IDEMPOTENCY_MISMATCH, CONFLICT, ...) map through the shared editorial table.
 */
export const relatedRpcError = (
  status: number,
  payload: unknown,
  operation: 'CMS-03C-05' | 'cmsRelatedContentRead' = 'CMS-03C-05',
): CmsRelatedContentError => {
  if (
    isRecord(payload) &&
    payload.code === '40001' &&
    SERIALIZATION_TOKENS.has(codeFromRpcError(payload))
  )
    return mapCmsCompositionRpcFailure(status, payload);
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
    const violations = POINTER_REASONS.has(reason.data)
      ? violationsFromDetailText(
          isRecord(payload) ? payload.details : null,
          reason.data,
        )
      : [];
    return failure(cmsSlice12ReasonStatus(reason.data), {
      reasonCode: reason.data,
      ...(violations.length > 0 ? { violations } : {}),
    });
  }
  if (!carriesProductToken(payload)) return failure(500);
  const mapped = mapCmsCompositionRpcFailure(status, payload);
  // A reason of another editorial domain cannot cross this operation boundary.
  if (mapped.details?.reasonCode !== undefined) return failure(500);
  return mapped;
};

/** The statuses BE03c's matrix leaves a bounded read: 409 and 422 are "not applicable", so a platform raise that maps there is a contract failure. */
const READ_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
]);

/**
 * cmsRelatedContentRead RPC failure to port refusal: the same named-token rules as CMS-03C-05 with the read's own token
 * list (`capability_missing` alone), and any refusal that lands on a write-only status (a version or idempotency
 * conflict, a validation failure) is a scrubbed 500.
 */
export const relatedReadRpcError = (
  status: number,
  payload: unknown,
): CmsRelatedContentError => {
  const mapped = relatedRpcError(status, payload, 'cmsRelatedContentRead');
  return READ_STATUSES.has(mapped.status) ? mapped : failure(500);
};
