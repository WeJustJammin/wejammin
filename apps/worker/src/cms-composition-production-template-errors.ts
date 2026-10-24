import {
  CMS_KEY_RESERVED_REASON,
  type CmsSlice12ReasonCode,
} from '@wejammin/contracts';

import { mapCmsCompositionRpcFailure } from './cms-composition-production-failure';
import { errorResult, isRecord } from './cms-editorial-production-errors';
import type { CmsEditorialProductionError } from './cms-editorial-production-types';

/**
 * PostgREST reports the platform's plain `RAISE EXCEPTION '<token>'` as SQLSTATE `P0001` with the
 * token as `message`; only that exact pair names the typed refusal below.
 */
const PLATFORM_RAISE_SQLSTATE = 'P0001';

/**
 * BE03c 323-327 and 1273 (DEC-186 item 2): a well-formed caller `blockRegistryDigest` that differs from the recomputed
 * one is the closed 409 refusal on CMS-03C-01 (`CMS_SLICE_12_OPERATION_REASONS['CMS-03C-01']` carries the token).
 */
const DIGEST_MISMATCH_REASON =
  'block_registry_digest_mismatch' as const satisfies CmsSlice12ReasonCode;

/**
 * CMS-03C-01 RPC failures. BE03c E13: the database refuses a reserved template key with the typed
 * token `key_reserved`, answered as the 422 whose `reasonCode` and violation both name
 * `/templateKey` (the pointer is fixed here, never read from the database's prose). The typed token
 * `block_registry_digest_mismatch` is the 409 whose `reasonCode` names itself and nothing else (the producer's
 * DETAIL pointer `["/blockRegistryDigest"]` is not relayed). Every other failure, including the E4 audience refusal (`VALIDATION_FAILED` with the DETAIL pointer
 * `["/audience"]`), takes the shared editorial mapping.
 */
export const mapTemplateRpcFailure = (
  status: number,
  payload: unknown,
): CmsEditorialProductionError => {
  const platformToken =
    isRecord(payload) &&
    status < 500 &&
    payload.code === PLATFORM_RAISE_SQLSTATE
      ? payload.message
      : undefined;
  if (platformToken === DIGEST_MISMATCH_REASON)
    return errorResult(
      409,
      'VERSION_CONFLICT',
      'The CMS template request conflicts with the current block registry.',
      { reasonCode: DIGEST_MISMATCH_REASON },
    );
  if (platformToken === CMS_KEY_RESERVED_REASON)
    return errorResult(
      422,
      'VALIDATION_FAILED',
      'The CMS template request failed validation.',
      {
        reasonCode: CMS_KEY_RESERVED_REASON,
        violations: [
          {
            path: '/templateKey',
            code: CMS_KEY_RESERVED_REASON,
            message: 'The value is invalid.',
          },
        ],
      },
    );
  return mapCmsCompositionRpcFailure(status, payload);
};
