import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { PatternNodePathSchema } from './key-grammar.ts';
import { CompositionInstanceResourceSchema } from './pattern-instance.ts';

/*
 * Linked update (D9, OD-2): CMS-03C-14 returns the three-way diff of one
 * instance, CMS-03C-15 accepts the new pattern version or detaches. A path is a
 * collision when the local override differs from the base and the new version
 * also changed it. An unanswered update overwrites nothing.
 */

export const CMS_UPDATE_DIFF_MAX_PATHS = 128;
export const CMS_UPDATE_DIFF_MAX_BYTES = 262_144;
export const CMS_UPDATE_MAX_INSTANCES = 32;
export const CMS_UPDATE_MAX_CHOICES = 128;

const PositiveInt32Schema = z.number().int().positive().max(2_147_483_647);
const InstanceStateSchema = z.enum([
  'draft',
  'active',
  'pending_diff',
  'superseded',
  'retired',
]);
const LinkModeSchema = z.enum(['linked', 'detached']);

/** `yours` keeps the local override, `theirs` takes the new pattern value. */
export const PatternUpdateChoiceSchema = z.strictObject({
  path: PatternNodePathSchema,
  choice: z.enum(['yours', 'theirs']),
});

const PatternUpdateTargetSchema = z.strictObject({
  instanceId: CmsUuidSchema,
  /** The instance's own `version`, its CAS operand. */
  expectedVersion: CmsVersionSchema,
  choices: z
    .array(PatternUpdateChoiceSchema)
    .max(CMS_UPDATE_MAX_CHOICES)
    .default([]),
});

const InstancesSchema = z
  .array(PatternUpdateTargetSchema)
  .min(1)
  .max(CMS_UPDATE_MAX_INSTANCES);

type UpdateInstances = z.infer<typeof InstancesSchema>;

const checkInstances = (
  instances: UpdateInstances,
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  instances.forEach((target, index) => {
    const id = target.instanceId.toLowerCase();
    if (seen.has(id))
      context.addIssue({
        code: 'custom',
        path: ['instances', index, 'instanceId'],
        message: 'instance_duplicate',
      });
    seen.add(id);
    if (instances.length > 1 && target.choices.length > 0)
      context.addIssue({
        code: 'custom',
        path: ['instances', index, 'choices'],
        message: 'choices_single_instance_only',
      });
    const paths = new Set<string>();
    target.choices.forEach((choice, choiceIndex) => {
      if (paths.has(choice.path))
        context.addIssue({
          code: 'custom',
          path: ['instances', index, 'choices', choiceIndex, 'path'],
          message: 'choice_path_duplicate',
        });
      paths.add(choice.path);
    });
  });
};

/**
 * CMS-03C-15 body. Bulk acceptance (up to 32 instances) is all-or-nothing and
 * admitted only when no listed instance collides (409 `diff_has_collisions`);
 * `choices` are allowed only for a single-instance request and must cover every
 * colliding path with `yours` or `theirs` (the server checks coverage).
 */
export const CompositionUpdateRequestSchema = z
  .discriminatedUnion('action', [
    z.strictObject({
      action: z.literal('accept'),
      targetPatternVersion: PositiveInt32Schema,
      instances: InstancesSchema,
      /** The entry aggregate `version`; the strong `If-Match` equals it. */
      expectedVersion: CmsVersionSchema,
    }),
    z.strictObject({
      action: z.literal('detach'),
      instances: InstancesSchema,
      expectedVersion: CmsVersionSchema,
    }),
  ])
  .superRefine((value, context) => checkInstances(value.instances, context));

/** CMS-03C-15 headers: key + the exact strong entry-version If-Match. */
export const CompositionUpdateHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/** CMS-03C-15 OpenAPI transport view: the route has no path parameters. */
export const CompositionUpdateApiRequestSchema = z
  .strictObject({
    headers: CompositionUpdateHeadersSchema,
    body: CompositionUpdateRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** CMS-03C-15 200 body: 1-32 appended composition rows. */
export const CompositionUpdateResourceSchema = z.strictObject({
  items: z
    .array(CompositionInstanceResourceSchema)
    .min(1)
    .max(CMS_UPDATE_MAX_INSTANCES),
});

/** CMS-03C-14 is addressed entirely by path: any query key is a 400. */
export const CompositionUpdateDiffApiRequestSchema = z.strictObject({
  instanceId: CmsUuidSchema,
  query: z.strictObject({}),
});

const CompositionUpdateDiffPathSchema = z.strictObject({
  path: PatternNodePathSchema,
  /** The pinned pattern value, the new active value and the local override; null when absent. */
  base: JsonValueSchema.nullable(),
  theirs: JsonValueSchema.nullable(),
  yours: JsonValueSchema.nullable(),
  collision: z.boolean(),
});

/**
 * CMS-03C-14 200 body. An instance with no newer `active` compatible version is
 * not an error: `paths` is empty, `collisionCount` 0, `bulkEligible` false and
 * `targetPatternVersion` equals `pinnedPatternVersion` (DEC-180 G4). A diff
 * over 128 paths or 256 KiB is 422 `diff_too_large`.
 */
export const CompositionUpdateDiffResourceSchema = z
  .strictObject({
    instance: z.strictObject({
      id: CmsUuidSchema,
      version: CmsVersionSchema,
      revisionId: CmsUuidSchema,
      path: z.string().max(512),
      state: InstanceStateSchema,
      linkMode: LinkModeSchema,
      pinnedPatternVersion: PositiveInt32Schema,
    }),
    targetPatternVersion: PositiveInt32Schema,
    paths: z
      .array(CompositionUpdateDiffPathSchema)
      .max(CMS_UPDATE_DIFF_MAX_PATHS),
    collisionCount: z.number().int().min(0).max(CMS_UPDATE_DIFF_MAX_PATHS),
    bulkEligible: z.boolean(),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.paths.forEach((entry, index) => {
      if (seen.has(entry.path))
        context.addIssue({
          code: 'custom',
          path: ['paths', index, 'path'],
          message: 'diff_path_duplicate',
        });
      seen.add(entry.path);
    });
    const collisions = value.paths.filter((entry) => entry.collision).length;
    if (value.collisionCount !== collisions)
      context.addIssue({
        code: 'custom',
        path: ['collisionCount'],
        message: 'collisionCount equals the paths flagged as collisions',
      });
    if (value.targetPatternVersion < value.instance.pinnedPatternVersion)
      context.addIssue({
        code: 'custom',
        path: ['targetPatternVersion'],
        message: 'the target version is never below the pinned version',
      });
    if (
      value.targetPatternVersion === value.instance.pinnedPatternVersion &&
      value.paths.length > 0
    )
      context.addIssue({
        code: 'custom',
        path: ['paths'],
        message: 'an instance with no newer version has an empty diff',
      });
    if (
      value.bulkEligible &&
      (value.collisionCount > 0 ||
        value.paths.length === 0 ||
        value.targetPatternVersion === value.instance.pinnedPatternVersion)
    )
      context.addIssue({
        code: 'custom',
        path: ['bulkEligible'],
        message:
          'bulk acceptance needs a newer version with changed paths and no collision',
      });
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      CMS_UPDATE_DIFF_MAX_BYTES
    )
      context.addIssue({ code: 'custom', message: 'diff_too_large' });
  });

export type PatternUpdateChoice = z.infer<typeof PatternUpdateChoiceSchema>;
export type CompositionUpdateRequest = z.infer<
  typeof CompositionUpdateRequestSchema
>;
export type CompositionUpdateResource = z.infer<
  typeof CompositionUpdateResourceSchema
>;
export type CompositionUpdateDiffResource = z.infer<
  typeof CompositionUpdateDiffResourceSchema
>;
