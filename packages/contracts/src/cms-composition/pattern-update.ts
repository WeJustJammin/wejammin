import { z } from 'zod';

import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { ExpandedPatternNodePathSchema } from './key-grammar.ts';
import { CompositionInstanceResourceSchema } from './pattern-instance.ts';

export * from './pattern-update-diff.ts';

/*
 * Linked update (D9, OD-2): CMS-03C-14 returns the three-way diff of one
 * instance, CMS-03C-15 accepts the new pattern version or detaches. A removed
 * block root or structural change collides even without a local override;
 * changed props collide when the local override differs from the base.
 * An unanswered update overwrites nothing (DEC-193).
 */

export const CMS_UPDATE_MAX_INSTANCES = 32;
export const CMS_UPDATE_MAX_CHOICES = 128;

const PositiveInt32Schema = z.number().int().positive().max(2_147_483_647);

/** DEC-193: `yours` selects the local node/props; `theirs` selects the target. */
export const PatternUpdateChoiceSchema = z.strictObject({
  path: ExpandedPatternNodePathSchema,
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

export type PatternUpdateChoice = z.infer<typeof PatternUpdateChoiceSchema>;
export type CompositionUpdateRequest = z.infer<
  typeof CompositionUpdateRequestSchema
>;
export type CompositionUpdateResource = z.infer<
  typeof CompositionUpdateResourceSchema
>;
