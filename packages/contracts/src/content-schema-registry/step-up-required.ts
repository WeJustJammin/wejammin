import { z } from 'zod';

import { RequestIdSchema } from '../identifiers.ts';

/**
 * Details of the 401 `STEP_UP_REQUIRED` response (BE03a: CMS-03A-04, -12, and
 * -14). Missing or stale MFA is recoverable by recent verification, so the
 * recovery is exactly `step_up` and never `reauthenticate`. `allowedMethods`
 * lists only configured allowlisted method identifiers and may be empty.
 */
export const CmsStepUpRequiredDetailsSchema = z
  .strictObject({
    recoveryAction: z.literal('step_up'),
    allowedMethods: z.array(z.string().min(1).max(64)).max(8).readonly(),
  })
  .readonly();

/** The BE00 `ApiError` envelope narrowed to the step-up code and details. */
export const CmsStepUpRequiredErrorSchema = z
  .strictObject({
    code: z.literal('STEP_UP_REQUIRED'),
    details: CmsStepUpRequiredDetailsSchema,
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
  })
  .readonly();

export type CmsStepUpRequiredDetails = z.infer<
  typeof CmsStepUpRequiredDetailsSchema
>;
