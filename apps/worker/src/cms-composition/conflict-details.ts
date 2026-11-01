import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import type { CapabilityOperationId } from './capability-details';

/**
 * The `reasonCode` of a 409, relayed alone: the source must name a 409 token (`cmsSlice12ReasonStatus`) that the
 * operation's `CMS_SLICE_12_OPERATION_REASONS` row publishes (BE03c 1273 and 1323, DEC-186 item 2: the closed
 * `block_registry_digest_mismatch` on CMS-03C-01). Anything else (a token of another status or operation, an unknown or
 * differently spelled token, a non-string) returns null and the caller keeps the plain 409 members. Mirror of
 * `forbiddenDetails` for the 409 status; the Web relay carries the same rule in `cms-composition-platform-conflict.ts`.
 */
export const conflictReasonDetails = (
  operationId: CapabilityOperationId,
  source: Readonly<Record<string, unknown>>,
): Readonly<{ reasonCode: string }> | null => {
  const reason = CmsSlice12ReasonCodeSchema.safeParse(source.reasonCode);
  return reason.success &&
    cmsSlice12ReasonStatus(reason.data) === 409 &&
    (CMS_SLICE_12_OPERATION_REASONS[operationId] as readonly string[]).includes(
      reason.data,
    )
    ? { reasonCode: reason.data }
    : null;
};
