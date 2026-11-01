import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import { cmsEditorialJsonDepth } from '../cms-editorial/primitives.ts';
import {
  CmsBlockKeySchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { PatternNodeKeySchema } from './key-grammar.ts';

/*
 * D9 / OD-2 pattern tree: a bounded forest of registered blocks and nested
 * pattern references. The contract proves the structure that needs no store:
 * grammar, sibling uniqueness, depth and the node count of the literal tree.
 * The `active` and compatibility state of a nested pattern, a cycle through a
 * nested lineage and the node count after expansion are server rules (422
 * `nested_pattern_not_active`, 409 `pattern_cycle`, 422 `pattern_nodes_exceeded`).
 */

export const CMS_PATTERN_MAX_ROOTS = 32;
export const CMS_PATTERN_MAX_CHILDREN = 32;
export const CMS_PATTERN_MAX_DEPTH = 8;
export const CMS_PATTERN_MAX_NODES = 512;
export const CMS_PATTERN_MAX_PROPS_KEYS = 64;
export const CMS_PATTERN_MAX_PROPS_DEPTH = 8;

const PositiveInt32Schema = z.number().int().positive().max(2_147_483_647);

/** Node props are data, never a renderer or executable expression (max 64 keys, depth 8). */
export const PatternNodePropsSchema = z
  .record(z.string().max(128), JsonValueSchema)
  .superRefine((props, context) => {
    if (Object.keys(props).length > CMS_PATTERN_MAX_PROPS_KEYS)
      context.addIssue({ code: 'custom', message: 'props_key_limit' });
    if (cmsEditorialJsonDepth(props) > CMS_PATTERN_MAX_PROPS_DEPTH)
      context.addIssue({ code: 'custom', message: 'props_depth_limit' });
  });

export type PatternNode =
  | {
      kind: 'block';
      key: string;
      blockKey: string;
      blockVersion: number;
      props: Record<string, z.infer<typeof JsonValueSchema>>;
      children: PatternNode[];
    }
  | {
      kind: 'pattern';
      key: string;
      patternId: string;
      patternVersion: number;
    };

export const PatternNodeSchema: z.ZodType<PatternNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('block'),
      key: PatternNodeKeySchema,
      blockKey: CmsBlockKeySchema,
      blockVersion: PositiveInt32Schema,
      props: PatternNodePropsSchema,
      children: z.array(PatternNodeSchema).max(CMS_PATTERN_MAX_CHILDREN),
    }),
    z.strictObject({
      kind: z.literal('pattern'),
      key: PatternNodeKeySchema,
      patternId: CmsUuidSchema,
      patternVersion: PositiveInt32Schema,
    }),
  ]),
);

/** The nodes of a forest as written, a nested pattern reference counting as one. */
export const countPatternNodes = (nodes: readonly PatternNode[]): number =>
  nodes.reduce(
    (total, node) =>
      total +
      1 +
      (node.kind === 'block' ? countPatternNodes(node.children) : 0),
    0,
  );

const checkSiblingsAndDepth = (
  nodes: readonly PatternNode[],
  path: readonly (string | number)[],
  level: number,
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  nodes.forEach((node, index) => {
    const here = [...path, index];
    if (seen.has(node.key))
      context.addIssue({
        code: 'custom',
        path: [...here, 'key'],
        message: 'node_key_duplicate',
      });
    seen.add(node.key);
    if (level > CMS_PATTERN_MAX_DEPTH) {
      context.addIssue({
        code: 'custom',
        path: here,
        message: 'pattern_depth_exceeded',
      });
      return;
    }
    if (node.kind === 'block')
      checkSiblingsAndDepth(
        node.children,
        [...here, 'children'],
        level + 1,
        context,
      );
  });
};

/** `blockTree`: 1-32 roots, unique sibling keys, depth at most 8, at most 512 written nodes. */
export const PatternBlockTreeSchema = z
  .array(PatternNodeSchema)
  .min(1)
  .max(CMS_PATTERN_MAX_ROOTS)
  .superRefine((nodes, context) => {
    checkSiblingsAndDepth(nodes, [], 1, context);
    if (countPatternNodes(nodes) > CMS_PATTERN_MAX_NODES)
      context.addIssue({ code: 'custom', message: 'pattern_nodes_exceeded' });
  });

export type PatternBlockTree = z.infer<typeof PatternBlockTreeSchema>;
