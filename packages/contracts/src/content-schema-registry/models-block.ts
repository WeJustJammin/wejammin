import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsEd25519SignatureSchema,
  CmsFieldKeySchema,
  CmsReleaseKeyIdSchema,
} from './primitives.ts';

/**
 * A props-field `constraints` object is bounded exactly as the database bounds
 * it (`cms_json_bounded(constraints, 8192, 4, 64, 128)`): at most 8 KiB of
 * compact UTF-8 JSON, four container levels, 64 keys per object and 128 items
 * per array. The Worker refuses an out-of-bounds object before the RPC.
 */
export const PROPS_CONSTRAINTS_MAX_BYTES = 8192;
export const PROPS_CONSTRAINTS_MAX_DEPTH = 4;
export const PROPS_CONSTRAINTS_MAX_KEYS = 64;
export const PROPS_CONSTRAINTS_MAX_ARRAY = 128;

const containerDepth = (value: unknown): number =>
  value !== null && typeof value === 'object'
    ? 1 + Math.max(0, ...Object.values(value).map(containerDepth))
    : 0;
const withinFanOut = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length <= PROPS_CONSTRAINTS_MAX_ARRAY && value.every(withinFanOut)
    : value !== null && typeof value === 'object'
      ? Object.keys(value).length <= PROPS_CONSTRAINTS_MAX_KEYS &&
        Object.values(value).every(withinFanOut)
      : true;
const withinPropsConstraintBounds = (value: Record<string, unknown>): boolean =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength <=
    PROPS_CONSTRAINTS_MAX_BYTES &&
  containerDepth(value) <= PROPS_CONSTRAINTS_MAX_DEPTH &&
  withinFanOut(value);

export const PropsSchemaFieldSchema = z
  .strictObject({
    name: CmsFieldKeySchema,
    kind: z.string().min(1).max(64),
    required: z.boolean(),
    constraints: z
      .record(z.string().max(128), JsonValueSchema)
      .refine(withinPropsConstraintBounds, 'props_constraints_out_of_bounds')
      .optional(),
  })
  .readonly();
export const PropsSchemaSnapshotSchema = z
  .strictObject({
    schemaVersion: z.string().min(1).max(32),
    fields: z.array(PropsSchemaFieldSchema).max(128).readonly(),
    additionalProperties: z.literal(false),
  })
  .readonly();
export const PropsSnapshotAttestationSchema = z
  .strictObject({
    algorithm: z.literal('Ed25519'),
    keyId: CmsReleaseKeyIdSchema,
    signature: CmsEd25519SignatureSchema,
  })
  .readonly();
export const BlockAccessibilitySchema = z
  .strictObject({
    nameRequired: z.boolean(),
    keyboard: z.literal(true),
    focusOrder: z.enum(['document', 'managed']),
    statusAnnouncement: z.boolean(),
  })
  .readonly();
export const BlockCompatibilitySchema = z
  .strictObject({
    minSchemaCompiler: z.string().min(1).max(32),
    maxSchemaCompiler: z.string().min(1).max(32),
  })
  .readonly();
export const BlockSlotRulesSchema = z
  .strictObject({
    maxDepth: z.number().int().min(1).max(16),
    maxNodes: z.number().int().min(1).max(512),
  })
  .readonly();
