import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';

/**
 * Request of the service-only, non-mutating resolver
 * `platform_api.cms_resolve_template_compatibility` (BE03c, DEC-108).
 * `contentTypeVersionId` is the exact candidate version; no current or latest
 * version is ever resolved implicitly. `expectedTemplateVersionNo` is the
 * template's own version number and only asserts, never selects.
 */
export const TemplateCompatibilityRequestSchema = z.strictObject({
  templateVersionId: CmsUuidSchema,
  contentTypeId: CmsUuidSchema,
  contentTypeVersionId: CmsUuidSchema,
  expectedTemplateVersionNo: CmsVersionSchema.optional(),
});

export const TemplateCompatibilityTemplateStateSchema = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
]);

/**
 * Safe success projection. Success is a typed invariant, never a caller claim:
 * an incompatible or withdrawn template is a typed failure, so the projection
 * can only say `compatible: true` and `withdrawn: false`. It carries no owner
 * IDs, binding manifests, slot internals, or renderer refs, and it is surfaced
 * to the browser only through `activationPreparation`.
 */
export const TemplateCompatibilityProjectionSchema = z.strictObject({
  templateVersionId: CmsUuidSchema,
  templateKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/u),
  templateVersionNo: CmsVersionSchema,
  state: TemplateCompatibilityTemplateStateSchema,
  compatible: z.literal(true),
  withdrawn: z.literal(false),
  templateDigest: CmsHashSchema,
  contentTypeId: CmsUuidSchema,
  contentTypeVersionId: CmsUuidSchema,
});

/**
 * Typed resolver failures. `NOT_FOUND` covers an absent or concealed
 * template/version/type; `VERSION_MISMATCH` is a mismatch of
 * `expectedTemplateVersionNo`.
 */
export const TemplateCompatibilityFailureCodeSchema = z.enum([
  'NOT_FOUND',
  'INCOMPATIBLE',
  'WITHDRAWN',
  'VERSION_MISMATCH',
]);

export const TemplateCompatibilityFailureSchema = z.strictObject({
  code: TemplateCompatibilityFailureCodeSchema,
});

export type TemplateCompatibilityRequest = z.infer<
  typeof TemplateCompatibilityRequestSchema
>;
export type TemplateCompatibilityProjection = z.infer<
  typeof TemplateCompatibilityProjectionSchema
>;
export type TemplateCompatibilityFailureCode = z.infer<
  typeof TemplateCompatibilityFailureCodeSchema
>;
export type TemplateCompatibilityFailure = z.infer<
  typeof TemplateCompatibilityFailureSchema
>;
