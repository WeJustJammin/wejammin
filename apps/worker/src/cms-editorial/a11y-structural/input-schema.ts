import {
  Bcp47Schema,
  CmsBlockKeySchema,
  CmsFieldKeySchema,
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '@wejammin/contracts';

import { renderIdentityKey, renderIdentityOf } from './render-plan';
import { z } from './zod-runtime';

/*
 * Input of the `cms.a11y.structural` checker (BE05c "Inputs"): the revision's
 * rich_text values (whole top-level values and the rich_text properties of
 * `object` fields, DEC-133) and the block instances in RENDER ORDER. The
 * checker never re-derives order, so the array order is the document order;
 * PostgreSQL `cms_revision_render_plan` is the one derivation of it and of each
 * node's stable location identity (`render-plan.ts`). A node of any other kind
 * (in particular a media reference, which cannot exist before Slice 14) is
 * refused, which the gate reports as TARGET_UNREADABLE: the checker fails
 * closed instead of silently skipping what it cannot judge.
 */

/** The BE05c input load is bounded; a revision references at most this many nodes. */
export const ACCESSIBILITY_NODES_MAX = 256;
/** RFC 6901 pointer bounds of a block node (`/composition/...`). */
export const ACCESSIBILITY_POINTER_MAX_CHARACTERS = 256;
export const ACCESSIBILITY_POINTER_MAX_SEGMENTS = 32;
/**
 * Raw upper bound of a block's accessibleName input. The checker judges the
 * 1 to 160 character rule itself; this only bounds what a load may hand over.
 */
export const ACCESSIBILITY_NAME_RAW_MAX_UNITS = 4096;

/** A lowercase uuid keeps every derived pointer and the binding hash canonical. */
const LowercaseUuidSchema = CmsUuidSchema.refine(
  (value) => value === value.toLowerCase(),
  'uuid_not_lowercase',
);

/** Non-empty segments of `[A-Za-z0-9_.-]` or the `~0` and `~1` escapes, 1 to 32 of them. */
const SAFE_POINTER_PATTERN = new RegExp(
  `^(?:/(?:[A-Za-z0-9_.-]|~[01])+){1,${ACCESSIBILITY_POINTER_MAX_SEGMENTS}}$`,
  'u',
);

const SafePointerSchema = z
  .string()
  .max(ACCESSIBILITY_POINTER_MAX_CHARACTERS)
  .regex(SAFE_POINTER_PATTERN, 'pointer_invalid');

const FieldNodeSchema = z.strictObject({
  kind: z.literal('field'),
  fieldId: LowercaseUuidSchema,
  /**
   * Present only for a rich_text property of an object field; absent for a whole
   * value. A DEC-133 property key has the grammar of a field key (lowercase,
   * 2 to 64 characters), so it is safe in a pointer.
   */
  propertyKey: CmsFieldKeySchema.optional(),
  fieldKind: z.literal('rich_text'),
  /** Validated by the checker with the shared rich_text.v1 validator. */
  value: z.unknown(),
});

const BlockNodeSchema = z.strictObject({
  kind: z.literal('block'),
  pointer: SafePointerSchema,
  blockKey: CmsBlockKeySchema,
  blockVersion: z.number().int().positive(),
  recordHash: CmsHashSchema,
  lifecycle: z.enum(['supported', 'deprecated', 'withdrawn', 'unregistered']),
  nameRequired: z.boolean(),
  accessibleNameFieldDefined: z.boolean(),
  accessibleName: z.string().max(ACCESSIBILITY_NAME_RAW_MAX_UNITS).nullable(),
});

const NodeSchema = z.discriminatedUnion('kind', [
  FieldNodeSchema,
  BlockNodeSchema,
]);

/** The member that names a node's location, for the issue path of a duplicate. */
const identityMember = (
  node: z.infer<typeof NodeSchema>,
): 'pointer' | 'propertyKey' | 'fieldId' => {
  if (node.kind === 'block') return 'pointer';
  return node.propertyKey === undefined ? 'fieldId' : 'propertyKey';
};

export const AccessibilityCheckerInputSchema = z.strictObject({
  revisionId: LowercaseUuidSchema,
  revisionNumber: CmsVersionSchema,
  /** The primary language is the lowercase first subtag. */
  locale: Bcp47Schema,
  revisionContentHash: CmsHashSchema,
  /** The manifest hash the evidence binds to. */
  dependencyHash: CmsHashSchema,
  renderPlanHash: CmsHashSchema,
  nodes: z
    .array(NodeSchema)
    .max(ACCESSIBILITY_NODES_MAX)
    .superRefine((nodes, context) => {
      const identities = new Set<string>();
      const wholeFields = new Set<string>();
      const objectFields = new Set<string>();
      nodes.forEach((node, index) => {
        const identity = renderIdentityKey(renderIdentityOf(node));
        if (identities.has(identity))
          context.addIssue({
            code: 'custom',
            path: [index, identityMember(node)],
            message: 'duplicate_node_identity',
          });
        identities.add(identity);
        if (node.kind !== 'field') return;
        // One field is either a whole rich_text value or an object with properties.
        const [own, other] =
          node.propertyKey === undefined
            ? [wholeFields, objectFields]
            : [objectFields, wholeFields];
        if (other.has(node.fieldId))
          context.addIssue({
            code: 'custom',
            path: [index, 'fieldId'],
            message: 'field_identity_mixed',
          });
        own.add(node.fieldId);
      });
    }),
});

export type AccessibilityCheckerInput = z.infer<
  typeof AccessibilityCheckerInputSchema
>;
export type AccessibilityNode = AccessibilityCheckerInput['nodes'][number];
export type FieldNode = Extract<AccessibilityNode, { kind: 'field' }>;
export type BlockNode = Extract<AccessibilityNode, { kind: 'block' }>;
