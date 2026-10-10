import { z } from 'zod';

import {
  ClaimRequestedEventSchema,
  requireClaimOwnKeys,
} from './schema-dry-run-claim-shape';

/** Private origin read only; no claim, report or execution authority. */
export const CmsSchemaDryRunOriginRequestSchema = requireClaimOwnKeys([
  'originEvent',
])
  .pipe(z.strictObject({ originEvent: ClaimRequestedEventSchema }))
  .transform((value) => Object.freeze(value));

export type CmsSchemaDryRunOriginRequest = z.infer<
  typeof CmsSchemaDryRunOriginRequestSchema
>;
