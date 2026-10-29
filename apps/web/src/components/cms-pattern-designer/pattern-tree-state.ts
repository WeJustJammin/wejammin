import type { PatternNode } from '@wejammin/contracts';

import { PATTERN_LIMITS } from './pattern-tree-rules';

/**
 * The editable form of a pattern block tree. Every node has a `uiId` that exists
 * only in the form (React keys, error links), is never sent and never persisted.
 * The operations are pure: each returns a new tree and leaves the old one intact.
 * A nested pattern node (`kind: 'pattern'`) can be moved and removed but not
 * authored by hand here: it is chosen in `CmsPatternNestedPicker` (`cmsPatternNestableRead`, DEC-196) and added with
 * `newPatternNode` (`pattern-tree-nested.ts`).
 */
export interface EditableNode {
  readonly uiId: string;
  readonly kind: 'block' | 'pattern';
  readonly key: string;
  /** `blockKey@blockVersion` of a registered block, or '' before one is chosen. */
  readonly blockRef: string;
  /** The props object as JSON text (data only, never an expression). */
  readonly propsText: string;
  readonly patternId: string;
  readonly patternVersion: number;
  readonly children: readonly EditableNode[];
}
export type EditableTree = readonly EditableNode[];
export type MakeId = () => string;

export interface NodeLocation {
  /** Child indices from the roots. */
  readonly path: readonly number[];
  /** 1 for a root. */
  readonly level: number;
  readonly index: number;
  readonly siblingCount: number;
}

/** Every node of the tree, nested ones included. */
export const countEditableNodes = (tree: EditableTree): number =>
  tree.reduce(
    (total, node) => total + 1 + countEditableNodes(node.children),
    0,
  );

/** A new block node with no block chosen and a key unused among `siblings`. */
export const newBlockNode = (
  siblings: EditableTree,
  makeId: MakeId,
): EditableNode => {
  const used = new Set(siblings.map((sibling) => sibling.key));
  let number = 1;
  while (used.has(`node-${number}`)) number += 1;
  return {
    uiId: makeId(),
    kind: 'block',
    key: `node-${number}`,
    blockRef: '',
    propsText: '{}',
    patternId: '',
    patternVersion: 0,
    children: [],
  };
};

export const locateNode = (
  tree: EditableTree,
  uiId: string,
  parentPath: readonly number[] = [],
): NodeLocation | null => {
  for (const [index, node] of tree.entries()) {
    const path = [...parentPath, index];
    if (node.uiId === uiId)
      return { path, level: path.length, index, siblingCount: tree.length };
    const inside = locateNode(node.children, uiId, path);
    if (inside !== null) return inside;
  }
  return null;
};

export const nodeAt = (
  tree: EditableTree,
  path: readonly number[],
): EditableNode | null => {
  let current: EditableTree = tree;
  let found: EditableNode | null = null;
  for (const index of path) {
    found = current[index] ?? null;
    if (found === null) return null;
    current = found.children;
  }
  return found;
};

/** The `uiId` of every nested pattern node, in document order. */
export const nestedPatternUiIds = (tree: EditableTree): string[] =>
  tree.flatMap((node) => [
    ...(node.kind === 'pattern' ? [node.uiId] : []),
    ...nestedPatternUiIds(node.children),
  ]);

export const canAddRoot = (tree: EditableTree): boolean =>
  tree.length < PATTERN_LIMITS.roots &&
  countEditableNodes(tree) < PATTERN_LIMITS.nodes;

export const canAddChild = (tree: EditableTree, uiId: string): boolean => {
  const location = locateNode(tree, uiId);
  const parent = location === null ? null : nodeAt(tree, location.path);
  return (
    location !== null &&
    parent !== null &&
    parent.kind === 'block' &&
    location.level < PATTERN_LIMITS.depth &&
    parent.children.length < PATTERN_LIMITS.children &&
    countEditableNodes(tree) < PATTERN_LIMITS.nodes
  );
};

const withinSiblings = (
  tree: EditableTree,
  uiId: string,
  change: (siblings: EditableTree) => EditableTree,
): EditableTree => {
  if (tree.some((node) => node.uiId === uiId)) return change(tree);
  let touched = false;
  const next = tree.map((node) => {
    const children = withinSiblings(node.children, uiId, change);
    if (children === node.children) return node;
    touched = true;
    return { ...node, children };
  });
  return touched ? next : tree;
};

const updateChildren = (
  tree: EditableTree,
  uiId: string,
  change: (children: EditableTree) => EditableTree,
): EditableTree =>
  withinSiblings(tree, uiId, (siblings) =>
    siblings.map((node) =>
      node.uiId === uiId ? { ...node, children: change(node.children) } : node,
    ),
  );

/** Append `node` under `parentUiId` (a root when null). */
export const addNode = (
  tree: EditableTree,
  parentUiId: string | null,
  node: EditableNode,
): EditableTree =>
  parentUiId === null
    ? [...tree, node]
    : updateChildren(tree, parentUiId, (children) => [...children, node]);

export const removeNode = (tree: EditableTree, uiId: string): EditableTree =>
  withinSiblings(tree, uiId, (siblings) =>
    siblings.filter((node) => node.uiId !== uiId),
  );

/** Swap a node with its previous (-1) or next (+1) sibling; the same tree at an end. */
export const moveNode = (
  tree: EditableTree,
  uiId: string,
  direction: -1 | 1,
): EditableTree =>
  withinSiblings(tree, uiId, (siblings) => {
    const from = siblings.findIndex((node) => node.uiId === uiId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= siblings.length) return siblings;
    const next = [...siblings];
    [next[from], next[to]] = [
      siblings[to] as EditableNode,
      siblings[from] as EditableNode,
    ];
    return next;
  });

export const updateNode = (
  tree: EditableTree,
  uiId: string,
  patch: Partial<Omit<EditableNode, 'uiId'>>,
): EditableTree =>
  withinSiblings(tree, uiId, (siblings) =>
    siblings.map((node) => (node.uiId === uiId ? { ...node, ...patch } : node)),
  );

export type WireIssueCode =
  'block_required' | 'props_not_json' | 'props_not_object';
export interface WireIssue {
  readonly uiId: string;
  readonly code: WireIssueCode;
  readonly member: 'blockRef' | 'props';
}
export type WireTreeResult =
  | { readonly ok: true; readonly nodes: PatternNode[] }
  | { readonly ok: false; readonly issues: WireIssue[] };

const BLOCK_REF = /^(.+)@([1-9]\d{0,9})$/u;

export const parseProps = (
  text: string,
):
  | { ok: true; value: Record<string, never> }
  | { ok: false; code: WireIssueCode } => {
  if (text.trim() === '') return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'props_not_json' };
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { ok: true, value: parsed as Record<string, never> }
    : { ok: false, code: 'props_not_object' };
};

/** The wire tree the form describes, or every node whose block or props text cannot be read. */
export const toWireTree = (tree: EditableTree): WireTreeResult => {
  const issues: WireIssue[] = [];
  const convert = (node: EditableNode): PatternNode => {
    if (node.kind === 'pattern')
      return {
        kind: 'pattern',
        key: node.key,
        patternId: node.patternId,
        patternVersion: node.patternVersion,
      };
    const ref = BLOCK_REF.exec(node.blockRef);
    if (ref === null)
      issues.push({
        uiId: node.uiId,
        code: 'block_required',
        member: 'blockRef',
      });
    const props = parseProps(node.propsText);
    if (!props.ok)
      issues.push({ uiId: node.uiId, code: props.code, member: 'props' });
    return {
      kind: 'block',
      key: node.key,
      blockKey: ref?.[1] ?? '',
      blockVersion: Number(ref?.[2] ?? 0),
      props: props.ok ? props.value : {},
      children: node.children.map(convert),
    };
  };
  const nodes = tree.map(convert);
  return issues.length === 0 ? { ok: true, nodes } : { ok: false, issues };
};

/** The editable form of a verified wire tree. */
export const fromWireTree = (
  nodes: readonly PatternNode[],
  makeId: MakeId,
): EditableTree =>
  nodes.map((node): EditableNode =>
    node.kind === 'pattern'
      ? {
          uiId: makeId(),
          kind: 'pattern',
          key: node.key,
          blockRef: '',
          propsText: '{}',
          patternId: node.patternId,
          patternVersion: node.patternVersion,
          children: [],
        }
      : {
          uiId: makeId(),
          kind: 'block',
          key: node.key,
          blockRef: `${node.blockKey}@${node.blockVersion}`,
          propsText: JSON.stringify(node.props, null, 2),
          patternId: '',
          patternVersion: 0,
          children: fromWireTree(node.children, makeId),
        },
  );
