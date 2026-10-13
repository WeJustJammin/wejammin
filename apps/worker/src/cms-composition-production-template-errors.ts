import { CMS_KEY_RESERVED_REASON } from '@wejammin/contracts';

import {
  errorResult,
  isRecord,
  mapCmsEditorialRpcFailure,
} from './cms-editorial-production-errors';
import type { CmsEditorialProductionError } from './cms-editorial-production-types';

/**
 * PostgREST reports the platform's plain `RAISE EXCEPTION '<token>'` as SQLSTATE `P0001` with the
 * token as `message`; only that exact pair names the typed refusal below.
 */
const PLATFORM_RAISE_SQLSTATE = 'P0001';

/**
 * CMS-03C-01 RPC failures. BE03c E13: the database refuses a reserved template key with the typed
 * token `key_reserved`, answered as the 422 whose `reasonCode` and violation both name
 * `/templateKey` (the pointer is fixed here, never read from the database's prose). Every other
 * failure, including the E4 audience refusal (`VALIDATION_FAILED` with the DETAIL pointer
 * `["/audience"]`), takes the shared editorial mapping.
 */
export const mapTemplateRpcFailure = (
  status: number,
  payload: unknown,
): CmsEditorialProductionError => {
  if (
    isRecord(payload) &&
    status < 500 &&
    payload.code === PLATFORM_RAISE_SQLSTATE &&
    payload.message === CMS_KEY_RESERVED_REASON
  )
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
  return mapCmsEditorialRpcFailure(status, payload);
};
