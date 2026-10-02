import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsBlockKeySchema,
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';

const hasSafeSlotPath = (value: string): boolean =>
  value.startsWith('/') &&
  [...value].every((character) => character.charCodeAt(0) >= 32);

const jsonDepth = (value: unknown): number => {
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(jsonDepth));
  if (value !== null && typeof value === 'object')
    return 1 + Math.max(0, ...Object.values(value).map(jsonDepth));
  return 0;
};

/** A pattern override is data, never a renderer or executable expression. */
export const PatternOverridesSchema = z
  .record(z.string().max(128), JsonValueSchema)
  .superRefine((overrides, context) => {
    if (Object.keys(overrides).length > 64)
      context.addIssue({ code: 'custom', message: 'overrides_key_limit' });
    if (jsonDepth(overrides) > 8)
      context.addIssue({ code: 'custom', message: 'overrides_depth_limit' });
  });

/** CMS-03C-02 request; actor and target authority are resolved by the Worker. */
export const PatternInstanceRequestSchema = z.strictObject({
  revisionId: CmsUuidSchema,
  patternId: CmsUuidSchema,
  patternVersion: z.number().int().positive(),
  linkMode: z.enum(['linked', 'detached']),
  slotPath: z
    .string()
    .min(1)
    .max(512)
    .refine(hasSafeSlotPath, 'slot_path_invalid'),
  overrides: PatternOverridesSchema,
  blockRegistryDigest: CmsHashSchema.optional(),
  expectedVersion: CmsVersionSchema,
});

export const PatternInstanceHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/** Canonical OpenAPI transport for the protected CMS-03C-02 mutation. */
export const PatternInstanceApiRequestSchema = z.strictObject({
  headers: PatternInstanceHeadersSchema,
  body: PatternInstanceRequestSchema,
});

/** Browser resource omits owner, session, and release-signing evidence. */
export const CompositionInstanceResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: z.enum(['draft', 'active', 'pending_diff', 'superseded', 'retired']),
  revisionId: CmsUuidSchema,
  path: z.string().min(1).max(512).refine(hasSafeSlotPath, 'path_invalid'),
  blockKey: CmsBlockKeySchema,
  blockVersion: z.number().int().positive(),
  patternId: CmsUuidSchema.nullable(),
  patternVersion: z.number().int().positive().nullable(),
  blockRegistryDigest: CmsHashSchema,
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
});

export type PatternInstanceRequest = z.infer<
  typeof PatternInstanceRequestSchema
>;
export type PatternInstanceHeaders = z.infer<
  typeof PatternInstanceHeadersSchema
>;
export type CompositionInstanceResource = z.infer<
  typeof CompositionInstanceResourceSchema
>;
