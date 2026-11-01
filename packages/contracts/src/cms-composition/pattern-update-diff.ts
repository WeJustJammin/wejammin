import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsBlockKeySchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { ExpandedPatternNodePathSchema } from './key-grammar.ts';
import {
  CMS_PATTERN_MAX_NODES,
  PatternNodePropsSchema,
} from './pattern-node.ts';

export const CMS_UPDATE_DIFF_MAX_PATHS = 128;
export const CMS_UPDATE_DIFF_MAX_BYTES = 262_144;

const PositiveInt32Schema = z.number().int().positive().max(2_147_483_647);
const hasSafeSlotPath = (value: string): boolean =>
  value.startsWith('/') &&
  [...value].every((character) => character.charCodeAt(0) >= 32);

/** CMS-03C-14 is addressed entirely by path: any query key is a 400. */
export const CompositionUpdateDiffApiRequestSchema = z.strictObject({
  instanceId: CmsUuidSchema,
  query: z.strictObject({}),
});

/** DEC-193: block identity, bounded props and full child addresses in order. */
export const CompositionDiffNodeValueSchema = z.strictObject({
  blockKey: CmsBlockKeySchema,
  blockVersion: PositiveInt32Schema,
  props: PatternNodePropsSchema,
  children: z.array(ExpandedPatternNodePathSchema).max(CMS_PATTERN_MAX_NODES),
});

/** The local `yours` override replaces props only; absent nodes are null. */
export const CompositionUpdateDiffPathSchema = z
  .strictObject({
    path: ExpandedPatternNodePathSchema,
    base: CompositionDiffNodeValueSchema.nullable(),
    theirs: CompositionDiffNodeValueSchema.nullable(),
    yours: JsonValueSchema.nullable(),
    collision: z.boolean(),
    collisionKind: z.enum(['removed_root', 'structure', 'props']).nullable(),
  })
  .superRefine((value, context) => {
    if (value.collision !== (value.collisionKind !== null))
      context.addIssue({
        code: 'custom',
        path: ['collisionKind'],
        message: 'a collision has exactly one kind; a non-collision has null',
      });
  });

/** New target roots have no instance; CMS-03C-02 `roots` places them. */
export const CompositionUpdateNewRootSchema = z.strictObject({
  rootPath: ExpandedPatternNodePathSchema,
  blockKey: CmsBlockKeySchema,
  blockVersion: PositiveInt32Schema,
});

const checkUniqueAddresses = (
  addresses: readonly string[],
  member: 'paths' | 'newRoots',
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  addresses.forEach((address, index) => {
    if (seen.has(address))
      context.addIssue({
        code: 'custom',
        path: [member, index, member === 'paths' ? 'path' : 'rootPath'],
        message:
          member === 'paths' ? 'diff_path_duplicate' : 'new_root_duplicate',
      });
    seen.add(address);
  });
};

/**
 * CMS-03C-14 200 body (DEC-193). A no-update answer carries a positive pin,
 * empty paths/newRoots, zero collisions, and no bulk action. The server checks
 * readable pattern provenance, newest-row status and linked active/pending
 * eligibility; a standalone row must never receive a fabricated pin.
 * A newer collision-free target is bulk-eligible even if no path changed.
 */
export const CompositionUpdateDiffResourceSchema = z
  .strictObject({
    instance: z.strictObject({
      id: CmsUuidSchema,
      version: CmsVersionSchema,
      revisionId: CmsUuidSchema,
      path: z.string().max(512),
      state: z.enum([
        'draft',
        'active',
        'pending_diff',
        'superseded',
        'retired',
      ]),
      linkMode: z.enum(['linked', 'detached']),
      pinnedPatternVersion: PositiveInt32Schema,
    }),
    slotPath: z
      .string()
      .min(1)
      .max(512)
      .refine(hasSafeSlotPath, 'slot_path_invalid'),
    targetPatternVersion: PositiveInt32Schema,
    paths: z
      .array(CompositionUpdateDiffPathSchema)
      .max(CMS_UPDATE_DIFF_MAX_PATHS),
    newRoots: z
      .array(CompositionUpdateNewRootSchema)
      .max(CMS_PATTERN_MAX_NODES),
    collisionCount: z.number().int().min(0).max(CMS_UPDATE_DIFF_MAX_PATHS),
    bulkEligible: z.boolean(),
  })
  .superRefine((value, context) => {
    checkUniqueAddresses(
      value.paths.map((entry) => entry.path),
      'paths',
      context,
    );
    checkUniqueAddresses(
      value.newRoots.map((root) => root.rootPath),
      'newRoots',
      context,
    );
    const collisions = value.paths.filter((entry) => entry.collision).length;
    if (value.collisionCount !== collisions)
      context.addIssue({
        code: 'custom',
        path: ['collisionCount'],
        message: 'collisionCount equals the paths flagged as collisions',
      });
    const pin = value.instance.pinnedPatternVersion;
    if (value.targetPatternVersion < pin)
      context.addIssue({
        code: 'custom',
        path: ['targetPatternVersion'],
        message: 'the target version is never below the pinned version',
      });
    if (value.targetPatternVersion === pin) {
      for (const key of ['paths', 'newRoots'] as const)
        if (value[key].length > 0)
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'an instance with no newer version has an empty diff',
          });
    }
    const eligible = value.targetPatternVersion > pin && collisions === 0;
    if (value.bulkEligible !== eligible)
      context.addIssue({
        code: 'custom',
        path: ['bulkEligible'],
        message: 'bulk acceptance requires a newer target and no collision',
      });
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      CMS_UPDATE_DIFF_MAX_BYTES
    )
      context.addIssue({ code: 'custom', message: 'diff_too_large' });
  });

export type CompositionDiffNodeValue = z.infer<
  typeof CompositionDiffNodeValueSchema
>;
export type CompositionUpdateDiffPath = z.infer<
  typeof CompositionUpdateDiffPathSchema
>;
export type CompositionUpdateNewRoot = z.infer<
  typeof CompositionUpdateNewRootSchema
>;
export type CompositionUpdateDiffResource = z.infer<
  typeof CompositionUpdateDiffResourceSchema
>;
