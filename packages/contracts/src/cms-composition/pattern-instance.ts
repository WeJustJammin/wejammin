import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import { cmsEditorialJsonDepth } from '../cms-editorial/primitives.ts';
import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
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
import { PatternNodePathSchema } from './key-grammar.ts';

const hasSafeSlotPath = (value: string): boolean =>
  value.startsWith('/') &&
  [...value].every((character) => character.charCodeAt(0) >= 32);

const MAX_OVERRIDE_KEYS = 64;
const MAX_OVERRIDE_DEPTH = 8;
/** The node cap after expansion bounds the rows one placement writes (DEC-181). */
export const CMS_PLACEMENT_MAX_ROWS = 512;

/**
 * DEC-175: a placement's `overrides` keys are normalized node paths under the
 * inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters), each
 * naming a node of the pinned pattern tree. Every other key is 422 at
 * `/overrides`, so the issue is reported once on the record, not per key. That
 * a path names a node of the pinned tree needs the tree and is the server's
 * check. An override is data, never a renderer or executable expression.
 */
export const PatternPlacementOverridesSchema = z
  .record(z.string(), JsonValueSchema)
  .superRefine((overrides, context) => {
    const keys = Object.keys(overrides);
    if (keys.length > MAX_OVERRIDE_KEYS)
      context.addIssue({ code: 'custom', message: 'overrides_key_limit' });
    if (cmsEditorialJsonDepth(overrides) > MAX_OVERRIDE_DEPTH)
      context.addIssue({ code: 'custom', message: 'overrides_depth_limit' });
    if (keys.some((key) => !PatternNodePathSchema.safeParse(key).success))
      context.addIssue({
        code: 'custom',
        message: 'override_key_not_node_path',
      });
  })
  .meta({
    propertyNames: {
      pattern: '^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63})*$',
      maxLength: 512,
    },
  });

/** CMS-03C-02 request; actor and target authority are resolved by the Worker. */
export const PatternInstanceRequestSchema = z.strictObject({
  revisionId: CmsUuidSchema,
  patternId: CmsUuidSchema,
  patternVersion: z.number().int().positive().max(2_147_483_647),
  linkMode: z.enum(['linked', 'detached']),
  slotPath: z
    .string()
    .min(1)
    .max(512)
    .refine(hasSafeSlotPath, 'slot_path_invalid'),
  overrides: PatternPlacementOverridesSchema,
  blockRegistryDigest: CmsHashSchema.optional(),
  expectedVersion: CmsVersionSchema,
});

export const PatternInstanceHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/**
 * Canonical OpenAPI transport for the protected CMS-03C-02 mutation. The strong
 * `If-Match` is the entry aggregate `version`, the body `expectedVersion`.
 */
export const PatternInstanceApiRequestSchema = z
  .strictObject({
    headers: PatternInstanceHeadersSchema,
    body: PatternInstanceRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** Browser resource omits owner, session, and release-signing evidence. */
export const CompositionInstanceResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: z.enum(['draft', 'active', 'pending_diff', 'superseded', 'retired']),
  revisionId: CmsUuidSchema,
  path: z.string().min(1).max(512).refine(hasSafeSlotPath, 'path_invalid'),
  /** DEC-185: the authored order within the slot; unchanged by accept, detach, scan and carry-over. */
  position: z.number().int().min(0).max(2_147_483_647),
  /**
   * DEC-175: for a pattern placement, the block identity of the block root this
   * row places; its `path` carries that root's `key` as the path suffix.
   */
  blockKey: CmsBlockKeySchema,
  blockVersion: z.number().int().positive(),
  patternId: CmsUuidSchema.nullable(),
  patternVersion: z.number().int().positive().nullable(),
  blockRegistryDigest: CmsHashSchema,
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
});

type CompositionInstanceResource = z.infer<
  typeof CompositionInstanceResourceSchema
>;

const checkPlacement = (
  items: readonly CompositionInstanceResource[],
  context: z.RefinementCtx,
): void => {
  const first = items[0];
  if (first === undefined) return;
  const paths = new Set<string>();
  const ids = new Set<string>();
  items.forEach((row, index) => {
    if (
      row.revisionId !== first.revisionId ||
      row.patternId !== first.patternId ||
      row.patternVersion !== first.patternVersion ||
      row.linkMode !== first.linkMode
    )
      context.addIssue({
        code: 'custom',
        path: ['items', index],
        message:
          'a placement pins every row to one revision, one pattern version and one link mode',
      });
    if (paths.has(row.path))
      context.addIssue({
        code: 'custom',
        path: ['items', index, 'path'],
        message: 'placement_path_duplicate',
      });
    paths.add(row.path);
    if (ids.has(row.id))
      context.addIssue({
        code: 'custom',
        path: ['items', index, 'id'],
        message: 'placement_row_duplicate',
      });
    ids.add(row.id);
    if (row.position !== first.position + index)
      context.addIssue({
        code: 'custom',
        path: ['items', index, 'position'],
        message: 'placement_positions_must_be_consecutive',
      });
  });
};

/**
 * DEC-175, DEC-181: a placement writes one `CompositionInstance` row per block
 * root of the pinned forest after top-level nested pattern references are
 * expanded into that pattern's own block roots, so the 201 is a list of one or
 * more rows, at most 512 (the node cap after expansion), in position order and
 * at consecutive positions, as `CompositionUpdateResource` is a list for
 * CMS-03C-15.
 */
export const PatternPlacementResourceSchema = z
  .strictObject({
    items: z
      .array(CompositionInstanceResourceSchema)
      .min(1)
      .max(CMS_PLACEMENT_MAX_ROWS),
  })
  .superRefine((value, context) => checkPlacement(value.items, context));

export type PatternInstanceRequest = z.infer<
  typeof PatternInstanceRequestSchema
>;
export type PatternInstanceHeaders = z.infer<
  typeof PatternInstanceHeadersSchema
>;
export type { CompositionInstanceResource };
export type PatternPlacementResource = z.infer<
  typeof PatternPlacementResourceSchema
>;
