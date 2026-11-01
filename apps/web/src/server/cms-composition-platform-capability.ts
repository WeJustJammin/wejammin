import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

/**
 * BE03c 1323 ("Slice 12 typed refusals"): the 403 tokens are `capability_missing` and `separation_of_duties`, and
 * `CMS_SLICE_12_OPERATION_REASONS` names the members each 03c operation may publish. The template, locale and
 * related-content operations publish `capability_missing` alone; CMS-03C-06/-07 also publish `separation_of_duties`.
 * The relayed `details` of an upstream 403 are that token alone when the source names a 403 token this operation
 * publishes. The pre-contract
 * upper-case `CAPABILITY_REQUIRED`, a token of another status or of another operation, any other member and an
 * untyped 403 all relay `{}`: nothing is repaired.
 *
 * Pass the operation whose row governs the response. `cmsTemplateContextRead` has no row of its own
 * (`error-catalog.ts` leaves it out), so it follows the template family's `CMS-03C-01` row; the template detail
 * read passes `cmsTemplateLatestRead`.
 */
export type CapabilityOperationId = keyof typeof CMS_SLICE_12_OPERATION_REASONS;

export const forbiddenDetails = (
  operationId: CapabilityOperationId,
  source: unknown,
): Record<string, unknown> => {
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return {};
  const reason = CmsSlice12ReasonCodeSchema.safeParse(
    (source as Readonly<Record<string, unknown>>).reasonCode,
  );
  return reason.success &&
    cmsSlice12ReasonStatus(reason.data) === 403 &&
    (CMS_SLICE_12_OPERATION_REASONS[operationId] as readonly string[]).includes(
      reason.data,
    )
    ? { reasonCode: reason.data }
    : {};
};
