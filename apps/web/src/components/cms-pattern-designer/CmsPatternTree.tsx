import * as React from 'react';

import CmsPatternNode, { type PatternNodeOps } from './CmsPatternNode';
import type { PatternSummaryItem } from './CmsPatternStatus';
import type { EditableNode } from './pattern-tree-state';

interface Props {
  readonly nodes: readonly EditableNode[];
  readonly parentPath?: readonly number[];
  readonly registeredBlocks: ReadonlyArray<{
    readonly blockKey: string;
    readonly blockVersion: number;
  }>;
  readonly issuesByNode: ReadonlyMap<string, readonly PatternSummaryItem[]>;
  readonly ops: PatternNodeOps;
}

/** The ordered `<ol>` of a pattern tree; each nested list is the children of its item. */
export default function CmsPatternTree({
  nodes,
  parentPath = [],
  registeredBlocks,
  issuesByNode,
  ops,
}: Props): React.ReactElement {
  return (
    <ol className="cms-pattern-tree-list">
      {nodes.map((node, index) => {
        const path = [...parentPath, index];
        return (
          <CmsPatternNode
            key={node.uiId}
            node={node}
            path={path}
            siblingCount={nodes.length}
            registeredBlocks={registeredBlocks}
            issues={issuesByNode.get(node.uiId) ?? []}
            ops={ops}
          >
            {node.children.length > 0 ? (
              <CmsPatternTree
                nodes={node.children}
                parentPath={path}
                registeredBlocks={registeredBlocks}
                issuesByNode={issuesByNode}
                ops={ops}
              />
            ) : null}
          </CmsPatternNode>
        );
      })}
    </ol>
  );
}
