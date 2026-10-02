import { z } from 'zod';

import {
  CmsCapabilityGrantReasonSchema,
  CmsCapabilityGrantStateSchema,
  CmsUtcDateSchema,
  GrantableCmsCapabilitySchema,
} from './models-grants.ts';
import {
  CmsOpaqueCursorSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from './primitives.ts';

/**
 * CMS-03A-15. `validThrough` is server-checked against the current UTC date
 * (today through today plus six days); the contract proves shape only.
 */
export const CapabilityGrantRequestSchema = z
  .strictObject({
    subjectPersonId: CmsUuidSchema,
    capability: GrantableCmsCapabilitySchema,
    validThrough: CmsUtcDateSchema,
    reason: CmsCapabilityGrantReasonSchema.optional(),
  })
  .readonly();

/** CMS-03A-16. The grant id is the path parameter. */
export const CapabilityGrantRenewalRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    validThrough: CmsUtcDateSchema,
    reason: CmsCapabilityGrantReasonSchema.optional(),
  })
  .readonly();

/** CMS-03A-17. The grant id is the path parameter. */
export const CapabilityGrantRevocationRequestSchema = z
  .strictObject({
    expectedVersion: CmsVersionSchema,
    reason: CmsCapabilityGrantReasonSchema.optional(),
  })
  .readonly();

/** CMS-03A-18 strict query. */
export const CmsCapabilityGrantListQuerySchema = z
  .strictObject({
    subjectPersonId: CmsUuidSchema.optional(),
    capability: GrantableCmsCapabilitySchema.optional(),
    state: CmsCapabilityGrantStateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: CmsOpaqueCursorSchema.optional(),
    sort: z.enum(['updatedAt', 'validThrough']).default('updatedAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  })
  .readonly();

export type CapabilityGrantRequest = z.infer<
  typeof CapabilityGrantRequestSchema
>;
export type CmsCapabilityGrantListQuery = z.infer<
  typeof CmsCapabilityGrantListQuerySchema
>;
