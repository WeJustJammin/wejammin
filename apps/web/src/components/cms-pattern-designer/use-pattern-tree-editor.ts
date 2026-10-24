import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PatternNodeOps } from './CmsPatternNode';
import { nodeDomId, nodeNumber, PATTERN_TREE_ID } from './pattern-designer-ids';
import {
  addNode,
  canAddChild,
  canAddRoot,
  locateNode,
  moveNode,
  newBlockNode,
  removeNode,
  updateNode,
  type EditableNode,
  type EditableTree,
} from './pattern-tree-state';

const makeId = (): string => crypto.randomUUID();

/**
 * The tree being edited, its operations, the polite announcement of each one and the
 * focus request that keeps the keyboard where the person was (a keyed reorder can
 * drop focus, and a removed node takes its controls with it).
 */
export const usePatternTreeEditor = (initial: EditableTree) => {
  const [tree, setTree] = useState<EditableTree>(initial);
  const [announcement, setAnnouncement] = useState('');
  const [focus, setFocus] = useState<{
    readonly id: string;
    readonly n: number;
  } | null>(null);

  useEffect(() => {
    if (focus !== null) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const requestFocus = useCallback((id: string): void => {
    setFocus((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  }, []);

  const label = useCallback((source: EditableTree, uiId: string): string => {
    const location = locateNode(source, uiId);
    return location === null ? '' : nodeNumber(location.path);
  }, []);

  const addRoot = useCallback((): void => {
    if (!canAddRoot(tree)) return;
    const node = newBlockNode(tree, makeId);
    const next = addNode(tree, null, node);
    setTree(next);
    setAnnouncement(`Added node ${label(next, node.uiId)}.`);
    requestFocus(nodeDomId(node.uiId, 'key'));
  }, [label, requestFocus, tree]);

  const addChild = useCallback(
    (parentUiId: string): void => {
      if (!canAddChild(tree, parentUiId)) return;
      const parent = locateNode(tree, parentUiId);
      const siblings = nodeAtPath(tree, parent?.path ?? []);
      const node = newBlockNode(siblings, makeId);
      const next = addNode(tree, parentUiId, node);
      setTree(next);
      setAnnouncement(`Added node ${label(next, node.uiId)}.`);
      requestFocus(nodeDomId(node.uiId, 'key'));
    },
    [label, requestFocus, tree],
  );

  const remove = useCallback(
    (uiId: string): void => {
      const name = label(tree, uiId);
      setTree(removeNode(tree, uiId));
      setAnnouncement(`Removed node ${name} and everything inside it.`);
      requestFocus(PATTERN_TREE_ID);
    },
    [label, requestFocus, tree],
  );

  const move = useCallback(
    (uiId: string, direction: -1 | 1): void => {
      const next = moveNode(tree, uiId, direction);
      if (next === tree) return;
      const location = locateNode(next, uiId);
      setTree(next);
      if (location === null) return;
      setAnnouncement(
        `Moved node to ${nodeNumber(location.path)}, position ${location.index + 1} of ${location.siblingCount}.`,
      );
      const atEnd =
        direction === -1
          ? location.index === 0
          : location.index === location.siblingCount - 1;
      requestFocus(
        nodeDomId(
          uiId,
          atEnd
            ? direction === -1
              ? 'down'
              : 'up'
            : direction === -1
              ? 'up'
              : 'down',
        ),
      );
    },
    [requestFocus, tree],
  );

  const update = useCallback(
    (uiId: string, patch: Partial<Omit<EditableNode, 'uiId'>>): void => {
      setTree((current) => updateNode(current, uiId, patch));
    },
    [],
  );

  const ops: PatternNodeOps = useMemo(
    () => ({
      update,
      move,
      remove,
      addChild,
      canAddChild: (uiId: string) => canAddChild(tree, uiId),
    }),
    [addChild, move, remove, tree, update],
  );

  return {
    tree,
    setTree,
    ops,
    addRoot,
    canAddRoot: canAddRoot(tree),
    announcement,
    requestFocus,
  };
};

/** The children list of the node at `path` (the roots for an empty path). */
const nodeAtPath = (
  tree: EditableTree,
  path: readonly number[],
): EditableTree => {
  let current = tree;
  for (const index of path) current = current[index]?.children ?? [];
  return current;
};
