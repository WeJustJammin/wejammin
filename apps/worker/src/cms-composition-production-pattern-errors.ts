import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import { mapCmsCompositionRpcFailure } from './cms-composition-production-failure';
import { codeFromRpcError, isRecord } from './cms-editorial-production-errors';
import { SERIALIZATION_TOKENS } from './cms-editorial-production-error-tokens';
import { carriesProductToken } from './cms-composition/provider-fault-guard';
import {
  BLOCK_RULES_REASON,
  blockRulesDetails,
} from './cms-composition/block-rules-refusal';
import {
  failure,
  type CmsPatternInstanceError,
} from './cms-composition/pattern-instance-contracts';

/** The producer guards of the placement graph (depth/nodes), raised at the request `patternId`. */
const PLACEMENT_GRAPH_GUARDS: ReadonlySet<string> = new Set([
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
]);
const PLACEMENT_GRAPH_POINTER = '/patternId';

/**
 * CMS-03C-02 RPC failure to port refusal. Named tokens only: the whole `message` of a platform raise
 * selects the refusal, prose, hints and supplied details never do (BE03c 1298-1304).
 *  - a Slice 12 reason token CMS-03C-02 publishes (BE03c 1304 and `CMS_SLICE_12_OPERATION_REASONS`:
 *    `capability_missing`, `revision_not_editable`, `pattern_cycle`, `block_registry_digest_mismatch`,
 *    `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, and DEC-210
 *    `block_rules_violated`) keeps its one catalog status and names itself in `details.reasonCode`, with
 *    no other member (DEC-186 for the digest token); the producer's JSON pointer DETAIL is not relayed,
 *    except for `block_rules_violated`, whose `/roots` or `/patternVersion` pointer is a bounded violation;
 *  - the placement graph guards `pattern_depth_exceeded` and `pattern_nodes_exceeded` (BE03c 378: max
 *    protected depth/nodes, 409/422) are a 422 `COMPOSITION_VALIDATION_FAILED` whose one violation points
 *    at `/patternId`; no `reasonCode` is invented because the CMS-03C-02 list does not contain them;
 *  - any other Slice 12 token, or one of another operation, is a contract failure: a scrubbed 500;
 *  - a 4xx that no platform raise produced (PostgREST `PGRST*`, a raw SQLSTATE, a non-object body) is a
 *    scrubbed 500; the generic BE03b tokens (NOT_FOUND, VERSION_MISMATCH with its version pair,
 *    VALIDATION_FAILED with its pointers, IDEMPOTENCY_MISMATCH, ...) map through the shared table.
 */
export const placementRpcError = (
  status: number,
  payload: unknown,
): CmsPatternInstanceError => {
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
  // Every 5xx keeps the unchanged 03b mapping (BE03c 1298-1302); only a 4xx names a Slice 12 token.
  if (status >= 500) return mapCmsCompositionRpcFailure(status, payload);
  const reason = CmsSlice12ReasonCodeSchema.safeParse(
    isRecord(payload) && payload.code === 'P0001' ? payload.message : undefined,
  );
  if (reason.success) {
    // BE03c 378: the placement graph guards (max protected depth/nodes) are a 422 validation refusal.
    // BE03c 1304 and the operation list give CMS-03C-02 no reasonCode for them, so none is invented.
    if (PLACEMENT_GRAPH_GUARDS.has(reason.data))
      return failure(422, {
        violations: [
          {
            path: PLACEMENT_GRAPH_POINTER,
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      });
    if (
      !(
        CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02'] as readonly string[]
      ).includes(reason.data)
    )
      return failure(500);
    // DEC-210: the one reason that relays its pointer, and only /roots or /patternVersion.
    if (reason.data === BLOCK_RULES_REASON)
      return failure(
        cmsSlice12ReasonStatus(reason.data),
        blockRulesDetails(
          isRecord(payload) ? payload.details : undefined,
          'CMS-03C-02',
        ),
      );
    return failure(cmsSlice12ReasonStatus(reason.data), {
      reasonCode: reason.data,
    });
  }
  if (!carriesProductToken(payload)) return failure(500);
  const mapped = mapCmsCompositionRpcFailure(status, payload);
  // A reason of another editorial domain cannot cross this operation boundary.
  if (mapped.details?.reasonCode !== undefined) return failure(500);
  return mapped;
};
