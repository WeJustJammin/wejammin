import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';

/*
 * BE03c key grammar (E13, E14, lineage ids). One definition of every key a
 * 03c definition is addressed by, shared by the request schemas, the browser
 * resources, the path parameters of the latest reads and the database CHECKs.
 *
 * Uniqueness is per owner (E14): `UNIQUE (owner_id, <key>, version)`. The
 * contracts never carry an owner, so a key held by another owner is
 * indistinguishable from an unused key and no schema here can leak it.
 */

/** BE03c E13: the `reasonCode` of a reserved-key refusal (422 at the key pointer). */
export const CMS_KEY_RESERVED_REASON = 'key_reserved';

/**
 * Template keys that collide with the fixed segments of
 * `/api/v1/cms/templates/{templateKey}` (`context`, `versions`) and of the
 * page `/app/cms-content-modeling/templates/new`.
 */
export const CMS_RESERVED_TEMPLATE_KEYS = [
  'context',
  'versions',
  'new',
] as const;

/**
 * Pattern keys that collide with the fixed segments of
 * `/api/v1/cms/patterns/{patternKey}` (`context`, `versions`, `selector`) and
 * of the page `/app/cms-content-modeling/patterns/new`.
 */
export const CMS_RESERVED_PATTERN_KEYS = [
  'context',
  'versions',
  'selector',
  'new',
] as const;

export const isReservedTemplateKey = (key: string): boolean =>
  (CMS_RESERVED_TEMPLATE_KEYS as readonly string[]).includes(key);

export const isReservedPatternKey = (key: string): boolean =>
  (CMS_RESERVED_PATTERN_KEYS as readonly string[]).includes(key);

/** CMS-03C-01 template keys are immutable across versioned definitions. */
export const CmsTemplateKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'template_key_invalid')
  .refine((key) => !isReservedTemplateKey(key), CMS_KEY_RESERVED_REASON);

/** CMS-03C-12 pattern keys; the grammar of a template key with its own reserved set. */
export const CmsPatternKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'pattern_key_invalid')
  .refine((key) => !isReservedPatternKey(key), CMS_KEY_RESERVED_REASON);

/** CMS-03C-16 vocabulary keys; no fixed route segment is reserved for a taxonomy. */
export const CmsTaxonomyKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'taxonomy_key_invalid');

/**
 * `templateId`, `patternId` and `taxonomyId`: the stable lineage id of
 * (owner, key), the `id` of the version-1 row carried on every successor row.
 */
export const CmsLineageIdSchema = CmsUuidSchema;

/** A pattern node key (DEC-175): 1 to 64 characters, unique among its siblings. */
export const PatternNodeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/u, 'node_key_invalid');

/**
 * A normalized node path under an inserted pattern root (DEC-175):
 * `/{nodeKey}(/{nodeKey})*`, at most 512 characters. The same grammar names an
 * `overrides` key and a `PatternUpdateChoice.path`.
 */
export const PatternNodePathSchema = z
  .string()
  .max(512, 'node_path_too_long')
  .regex(
    /^\/[a-z][a-z0-9_-]{0,63}(?:\/[a-z][a-z0-9_-]{0,63})*$/u,
    'node_path_invalid',
  );

export type CmsTemplateKey = z.infer<typeof CmsTemplateKeySchema>;
export type CmsPatternKey = z.infer<typeof CmsPatternKeySchema>;
export type CmsTaxonomyKey = z.infer<typeof CmsTaxonomyKeySchema>;
