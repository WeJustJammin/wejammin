import { z } from 'zod';

import {
  CmsBlockKeySchema,
  CmsHashSchema,
  CmsLocaleSchema,
  CmsProjectionKeySchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineConditionalIfMatch } from './conditional-if-match.ts';
import { CmsLineageIdSchema, CmsTemplateKeySchema } from './key-grammar.ts';

// The key grammar (including the reserved set, E13) has one definition; the
// public name stays exported from here for the lazy browser validators.
export { CmsTemplateKeySchema };

const TemplateSlotKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{1,63}$/u, 'slot_key_invalid');

export const RegisteredBlockSchema = z.strictObject({
  blockKey: CmsBlockKeySchema,
  blockVersion: z.number().int().positive().max(2_147_483_647),
});

/** Protected CMS-11 picker input; authority is rechecked by every mutation. */
export const TemplateDesignerContextSchema = z.strictObject({
  contentTypes: z
    .array(
      z.strictObject({
        id: CmsUuidSchema,
        typeKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/u),
        activeVersionId: CmsUuidSchema,
        activeVersion: z.number().int().positive().max(2_147_483_647),
        sourceLocale: CmsLocaleSchema,
      }),
    )
    .max(64),
  registeredBlocks: z.array(RegisteredBlockSchema).max(128),
});

export type TemplateDesignerContext = z.infer<
  typeof TemplateDesignerContextSchema
>;

const TemplateSlotSchema = z.strictObject({
  key: TemplateSlotKeySchema,
  required: z.boolean(),
  allowedBlocks: z
    .array(RegisteredBlockSchema)
    .max(32)
    .superRefine((blocks, context) => {
      const seen = new Set<string>();
      blocks.forEach((block, index) => {
        const identity = `${block.blockKey}\u0000${block.blockVersion}`;
        if (seen.has(identity))
          context.addIssue({
            code: 'custom',
            message: 'block_reference_duplicate',
            path: [index],
          });
        seen.add(identity);
      });
    }),
  maxCount: z.number().int().min(1).max(128),
});

const protectedRegions = [
  'header',
  'now',
  'record',
  'detail',
  'provenance',
] as const;

const ReservedRegionsSchema = z
  .array(TemplateSlotKeySchema)
  .min(protectedRegions.length)
  .max(32)
  .superRefine((regions, context) => {
    protectedRegions.forEach((required, index) => {
      if (regions[index] !== required)
        context.addIssue({
          code: 'custom',
          message: 'protected_region_position_invalid',
          path: [index],
        });
    });
    const seen = new Set<string>();
    regions.forEach((region, index) => {
      if (seen.has(region))
        context.addIssue({
          code: 'custom',
          message: 'reserved_region_duplicate',
          path: [index],
        });
      seen.add(region);
    });
  });

/**
 * E4: the BE04c deliverable audience grammar, `^[a-z0-9_-]{1,48}$`, matched as
 * submitted and never trimmed, so a padded or mixed-case audience is refused.
 */
const SafeAudienceSchema = z
  .string()
  .regex(/^[a-z0-9_-]{1,48}$/u, 'audience_invalid');

export const TemplateVersionRequestSchema = z.strictObject({
  templateKey: CmsTemplateKeySchema,
  compatibleTypeIds: z
    .array(CmsUuidSchema)
    .min(1)
    .max(64)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      {
        message: 'compatible_type_duplicate',
      },
    ),
  slots: z
    .array(TemplateSlotSchema)
    .max(64)
    .superRefine((slots, context) => {
      const seen = new Set<string>();
      slots.forEach((slot, index) => {
        if (seen.has(slot.key))
          context.addIssue({
            code: 'custom',
            message: 'template_slot_duplicate',
            path: [index, 'key'],
          });
        seen.add(slot.key);
      });
    }),
  reservedRegions: ReservedRegionsSchema,
  bindings: z.record(
    z.string().max(128),
    z.strictObject({
      projection: CmsProjectionKeySchema,
      required: z.boolean(),
    }),
  ),
  locale: CmsLocaleSchema,
  audience: SafeAudienceSchema,
  blockRegistryDigest: CmsHashSchema.optional(),
  expectedVersion: CmsVersionSchema.nullable(),
});

/** Creation omits If-Match; versioning requires its quoted strong form. */
export const TemplateVersionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema.optional(),
});

/**
 * OpenAPI transport shape; If-Match is absent on a first version and equals
 * the parent `expectedVersion` on a successor.
 */
export const TemplateVersionApiRequestSchema = z
  .strictObject({
    headers: TemplateVersionHeadersSchema,
    body: TemplateVersionRequestSchema,
  })
  .superRefine(refineConditionalIfMatch);

export const TemplateVersionResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: z.enum([
    'draft',
    'review',
    'approved',
    'scheduled',
    'active',
    'superseded',
    'retired',
    'blocked',
  ]),
  templateId: CmsLineageIdSchema,
  templateKey: CmsTemplateKeySchema,
  templateVersion: z.number().int().positive(),
  compatibleTypeIds: z.array(CmsUuidSchema).max(64),
  reservedRegions: z.array(TemplateSlotKeySchema).max(32),
  blockRegistryDigest: CmsHashSchema,
});

export type TemplateVersionRequest = z.infer<
  typeof TemplateVersionRequestSchema
>;
export type TemplateVersionHeaders = z.infer<
  typeof TemplateVersionHeadersSchema
>;
export type TemplateVersionResource = z.infer<
  typeof TemplateVersionResourceSchema
>;
