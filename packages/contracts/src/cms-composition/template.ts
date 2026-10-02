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

/** CMS-03C-01 template keys are immutable across versioned definitions. */
export const CmsTemplateKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'template_key_invalid');

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

const SafeAudienceSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !/[<>{}]/u.test(value), 'audience_invalid');

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

/** OpenAPI transport shape; If-Match is required only for an existing version. */
export const TemplateVersionApiRequestSchema = z.strictObject({
  headers: TemplateVersionHeadersSchema,
  body: TemplateVersionRequestSchema,
});

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
