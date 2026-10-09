import {
  Bcp47Schema,
  CmsBlockKeySchema,
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '@wejammin/contracts';

import { z } from './zod-runtime';

/*
 * Input of the `cms.a11y.structural` checker (BE05c "Inputs"): the revision's
 * rich_text values and the block instances in RENDER ORDER. The checker never
 * re-derives order, so the array order is the document order. A node of any
 * other kind (in particular a media reference, which cannot exist before
 * Slice 14) is refused, which the gate reports as TARGET_UNREADABLE: the
 * checker fails closed instead of silently skipping what it cannot judge.
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
      const fieldIds = new Set<string>();
      const pointers = new Set<string>();
      nodes.forEach((node, index) => {
        const seen = node.kind === 'field' ? fieldIds : pointers;
        const key = node.kind === 'field' ? node.fieldId : node.pointer;
        if (seen.has(key))
          context.addIssue({
            code: 'custom',
            path: [index, node.kind === 'field' ? 'fieldId' : 'pointer'],
            message: 'duplicate_node_identity',
          });
        seen.add(key);
      });
    }),
});

export type AccessibilityCheckerInput = z.infer<
  typeof AccessibilityCheckerInputSchema
>;
export type AccessibilityNode = AccessibilityCheckerInput['nodes'][number];
export type FieldNode = Extract<AccessibilityNode, { kind: 'field' }>;
export type BlockNode = Extract<AccessibilityNode, { kind: 'block' }>;
