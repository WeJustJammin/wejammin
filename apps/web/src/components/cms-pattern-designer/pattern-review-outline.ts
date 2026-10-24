import type { PatternNode } from '@wejammin/contracts';

import type { EditableNode, EditableTree } from './pattern-tree-state';

/**
 * A read-only outline of a pattern tree for the conflict review (FE03 :1216): each
 * node is its key and one sentence naming the block and props or the nested pattern.
 * Both sides of the comparison are reduced to this shape, so equal data compares
 * equal whether it came from the server or from the form.
 */
export interface OutlineNode {
  readonly key: string;
  readonly summary: string;
  readonly children: readonly OutlineNode[];
}

/** `same`: equal here and there; `changed`: same key, different summary; `only`: absent on the other side. */
export type OutlineStatus = 'same' | 'changed' | 'only';
export interface MarkedOutlineNode {
  readonly key: string;
  readonly summary: string;
  readonly status: OutlineStatus;
  readonly children: readonly MarkedOutlineNode[];
}

const nestedSummary = (patternId: string, version: number): string =>
  `nested pattern ${patternId} version ${version}`;

const blockSummary = (ref: string, props: string | null): string =>
  props === null || props === '{}' ? ref : `${ref} · props ${props}`;

export const outlineFromWire = (nodes: readonly PatternNode[]): OutlineNode[] =>
  nodes.map((node) =>
    node.kind === 'pattern'
      ? {
          key: node.key,
          summary: nestedSummary(node.patternId, node.patternVersion),
          children: [],
        }
      : {
          key: node.key,
          summary: blockSummary(
            `${node.blockKey}@${node.blockVersion}`,
            JSON.stringify(node.props),
          ),
          children: outlineFromWire(node.children),
        },
  );

/** Props as the person typed them, canonicalised when they parse so equal data is equal. */
const canonicalProps = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text) as unknown);
  } catch {
    return text.trim();
  }
};

const editableSummary = (node: EditableNode): string =>
  node.kind === 'pattern'
    ? nestedSummary(node.patternId, node.patternVersion)
    : node.blockRef === ''
      ? 'no block chosen'
      : blockSummary(node.blockRef, canonicalProps(node.propsText));

export const outlineFromEditable = (tree: EditableTree): OutlineNode[] =>
  tree.map((node) => ({
    key: node.key,
    summary: editableSummary(node),
    children: outlineFromEditable(node.children),
  }));

/** Mark each node of `side` against the node with the same key at the same position of `other`. */
export const annotateOutline = (
  side: readonly OutlineNode[],
  other: readonly OutlineNode[],
): MarkedOutlineNode[] =>
  side.map((node) => {
    const match = other.find((candidate) => candidate.key === node.key);
    return {
      key: node.key,
      summary: node.summary,
      status:
        match === undefined
          ? 'only'
          : match.summary === node.summary
            ? 'same'
            : 'changed',
      children: annotateOutline(node.children, match?.children ?? []),
    };
  });

/** Content types by key; an id the context no longer offers is named by its id prefix. */
export const typeChoiceLabels = (
  ids: readonly string[],
  context: {
    readonly contentTypes: ReadonlyArray<{
      readonly id: string;
      readonly typeKey: string;
    }>;
  },
): string[] =>
  ids.map(
    (id) =>
      context.contentTypes.find((type) => type.id === id)?.typeKey ??
      `${id.slice(0, 8)} (no longer available)`,
  );
