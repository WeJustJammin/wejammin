import type { PatternNode } from '@wejammin/contracts';
import { isCmsUuid } from '@wejammin/contracts/client';

/*
 * The structural rules of a pattern block tree (BE03c CMS-03C-12, D9/OD-2), written
 * out zod-free so the designer island ships no schema (FE03 performance budgets,
 * AC261). `pattern-tree-rules.test.ts` is the drift guard: it holds every constant
 * and the accept/refuse decision of this module equal to `PatternBlockTreeSchema`
 * and `CmsPatternKeySchema`. The Worker and the same-origin proxy stay the
 * authority; this module only lets the form name the node a rule refuses, because
 * the Worker answers a tree violation without a node pointer.
 */

export const PATTERN_LIMITS = {
  roots: 32,
  children: 32,
  depth: 8,
  nodes: 512,
  propsKeys: 64,
  propsDepth: 8,
} as const;

/** Pattern keys that collide with the fixed route segments of the pattern API and pages. */
export const PATTERN_RESERVED_KEYS = [
  'context',
  'versions',
  'selector',
  'nestable',
  'new',
] as const;

/** The contract grammars (`CmsPatternKeySchema`, `PatternNodeKeySchema`, `CMS_BLOCK_KEY_PATTERN`); the drift guard compares source and flags. */
export const PATTERN_KEY_REGEX = /^[a-z][a-z0-9-]{1,63}$/u;
export const NODE_KEY_REGEX = /^[a-z][a-z0-9_-]{0,63}$/u;
export const BLOCK_KEY_REGEX = /^[a-z][a-z0-9._-]{0,95}$/u;
/** The bounds of a prop value (`JsonValueSchema`, `PatternNodePropsSchema`). */
export const PATTERN_JSON_LIMITS = {
  containerItems: 128,
  bytes: 262_144,
  propsKeyLength: 128,
} as const;
const MAX_INT32 = 2_147_483_647;

export const isPatternNodeKey = (key: string): boolean =>
  NODE_KEY_REGEX.test(key);
export const isBlockKey = (key: string): boolean => BLOCK_KEY_REGEX.test(key);

/** The reason a pattern key is refused, or null. */
export const patternKeyIssue = (
  key: string,
): 'pattern_key_invalid' | 'key_reserved' | null => {
  if (!PATTERN_KEY_REGEX.test(key)) return 'pattern_key_invalid';
  return (PATTERN_RESERVED_KEYS as readonly string[]).includes(key)
    ? 'key_reserved'
    : null;
};

export type PatternTreeIssueCode =
  | 'tree_empty'
  | 'roots_exceeded'
  | 'children_exceeded'
  | 'node_key_invalid'
  | 'node_key_duplicate'
  | 'pattern_depth_exceeded'
  | 'pattern_nodes_exceeded'
  | 'block_key_invalid'
  | 'block_version_invalid'
  | 'pattern_id_invalid'
  | 'pattern_version_invalid'
  | 'props_key_limit'
  | 'props_depth_limit'
  | 'props_invalid';

export type PatternTreeMember =
  | 'key'
  | 'blockKey'
  | 'blockVersion'
  | 'props'
  | 'children'
  | 'patternId'
  | 'patternVersion'
  | null;

export interface PatternTreeIssue {
  readonly code: PatternTreeIssueCode;
  /** Child indices from the roots; empty for a tree-level issue. */
  readonly nodePath: readonly number[];
  readonly member: PatternTreeMember;
}

type JsonObject = Readonly<Record<string, unknown>>;

const isPlainObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/** Container nesting, never scalar leaves (BE03b `jsonDepth`). */
const containerDepth = (value: unknown): number => {
  if (typeof value !== 'object' || value === null) return 0;
  const members = Array.isArray(value) ? value : Object.values(value);
  return 1 + Math.max(0, ...members.map(containerDepth));
};

/** The bounded JSON value of a node prop: finite numbers, 128 items per container. */
const isBoundedJson = (value: unknown, depth = 0): boolean => {
  if (value === null) return true;
  if (typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth >= PATTERN_LIMITS.propsDepth) return false;
  if (Array.isArray(value))
    return (
      value.length <= PATTERN_JSON_LIMITS.containerItems &&
      value.every((member) => isBoundedJson(member, depth + 1))
    );
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length <= PATTERN_JSON_LIMITS.containerItems &&
    keys.every((key) => isBoundedJson(value[key], depth + 1))
  );
};

export const propsIssue = (props: unknown): PatternTreeIssueCode | null => {
  if (!isPlainObject(props)) return 'props_invalid';
  const keys = Object.keys(props);
  if (keys.length > PATTERN_LIMITS.propsKeys) return 'props_key_limit';
  if (containerDepth(props) > PATTERN_LIMITS.propsDepth)
    return 'props_depth_limit';
  if (
    keys.some((key) => key.length > PATTERN_JSON_LIMITS.propsKeyLength) ||
    !keys.every((key) => isBoundedJson(props[key])) ||
    keys.some(
      (key) =>
        new TextEncoder().encode(JSON.stringify(props[key])).byteLength >
        PATTERN_JSON_LIMITS.bytes,
    )
  )
    return 'props_invalid';
  return null;
};

const isPositiveInt32 = (value: unknown): boolean =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= MAX_INT32;

/** The nodes of a forest as written; a nested pattern reference counts as one. */
export const countWrittenNodes = (nodes: readonly PatternNode[]): number =>
  nodes.reduce(
    (total, node) =>
      total +
      1 +
      (node.kind === 'block' ? countWrittenNodes(node.children) : 0),
    0,
  );

/**
 * Every rule of `PatternBlockTreeSchema`, each issue naming the node it refuses:
 * 1-32 roots, at most 32 children, unique sibling keys, node and block grammar,
 * props bounds, depth at most 8 (the first node beyond it; its subtree is not
 * descended) and at most 512 written nodes (the first node beyond the limit, in
 * document order). Expansion of nested patterns is a server rule.
 */
export const validatePatternTree = (
  nodes: readonly PatternNode[],
): PatternTreeIssue[] => {
  const issues: PatternTreeIssue[] = [];
  let ordinal = 0;
  let overflowReported = false;
  const add = (
    code: PatternTreeIssueCode,
    nodePath: readonly number[],
    member: PatternTreeMember,
  ): void => {
    issues.push({ code, nodePath, member });
  };
  const visit = (
    siblings: readonly PatternNode[],
    parentPath: readonly number[],
    level: number,
  ): void => {
    const seen = new Set<string>();
    siblings.forEach((node, index) => {
      const path = [...parentPath, index];
      ordinal += 1;
      if (ordinal > PATTERN_LIMITS.nodes && !overflowReported) {
        overflowReported = true;
        add('pattern_nodes_exceeded', path, null);
      }
      if (!NODE_KEY_REGEX.test(node.key)) add('node_key_invalid', path, 'key');
      if (seen.has(node.key)) add('node_key_duplicate', path, 'key');
      seen.add(node.key);
      if (level > PATTERN_LIMITS.depth) {
        add('pattern_depth_exceeded', path, null);
        return;
      }
      if (node.kind === 'pattern') {
        if (!isCmsUuid(node.patternId))
          add('pattern_id_invalid', path, 'patternId');
        if (!isPositiveInt32(node.patternVersion))
          add('pattern_version_invalid', path, 'patternVersion');
        return;
      }
      if (!BLOCK_KEY_REGEX.test(node.blockKey))
        add('block_key_invalid', path, 'blockKey');
      if (!isPositiveInt32(node.blockVersion))
        add('block_version_invalid', path, 'blockVersion');
      const props = propsIssue(node.props);
      if (props !== null) add(props, path, 'props');
      if (node.children.length > PATTERN_LIMITS.children)
        add('children_exceeded', path, 'children');
      visit(node.children, path, level + 1);
    });
  };
  if (nodes.length === 0) add('tree_empty', [], null);
  if (nodes.length > PATTERN_LIMITS.roots) add('roots_exceeded', [], null);
  visit(nodes, [], 1);
  return issues;
};

const hasExactly = (value: JsonObject, members: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return (
    keys.length === members.length && members.every((m) => keys.includes(m))
  );
};

const asWireNode = (value: unknown): PatternNode | null => {
  if (!isPlainObject(value)) return null;
  if (value.kind === 'pattern') {
    return hasExactly(value, ['kind', 'key', 'patternId', 'patternVersion']) &&
      typeof value.key === 'string' &&
      typeof value.patternId === 'string' &&
      typeof value.patternVersion === 'number'
      ? (value as unknown as PatternNode)
      : null;
  }
  if (
    value.kind !== 'block' ||
    !hasExactly(value, [
      'kind',
      'key',
      'blockKey',
      'blockVersion',
      'props',
      'children',
    ]) ||
    typeof value.key !== 'string' ||
    typeof value.blockKey !== 'string' ||
    typeof value.blockVersion !== 'number' ||
    !isPlainObject(value.props) ||
    !Array.isArray(value.children)
  )
    return null;
  const children = value.children.map(asWireNode);
  return children.every((child) => child !== null)
    ? ({ ...value, children } as unknown as PatternNode)
    : null;
};

/** A tree read from the server, shape-checked and rule-checked, or null. */
export const parseWireTree = (value: unknown): PatternNode[] | null => {
  if (!Array.isArray(value)) return null;
  const nodes = value.map(asWireNode);
  if (!nodes.every((node) => node !== null)) return null;
  return validatePatternTree(nodes).length === 0 ? nodes : null;
};
