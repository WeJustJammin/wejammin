import * as React from 'react';

import {
  annotateOutline,
  outlineFromEditable,
  outlineFromWire,
  typeChoiceLabels,
  type MarkedOutlineNode,
} from './pattern-review-outline';
import type { PatternDesignerContext } from './pattern-designer-request';
import type { PatternLatestDetail } from './pattern-latest-read';
import type { EditableTree } from './pattern-tree-state';

interface Props {
  readonly latest: PatternLatestDetail;
  readonly draftTree: EditableTree;
  readonly draftTypeIds: readonly string[];
  readonly context: PatternDesignerContext;
}

interface SideProps {
  readonly id: string;
  readonly title: string;
  /** Words for a node the other side lacks. */
  readonly onlyHere: string;
  readonly typeLabels: readonly string[];
  readonly nodes: readonly MarkedOutlineNode[];
}

const STATUS_WORDS = { same: '', changed: ' (changed)' } as const;

function Outline({
  nodes,
  onlyHere,
}: {
  readonly nodes: readonly MarkedOutlineNode[];
  readonly onlyHere: string;
}): React.ReactElement {
  return (
    <ol className="cms-pattern-review-list">
      {nodes.map((node) => (
        <li key={node.key}>
          <span>
            <strong>{node.key}</strong> <code>{node.summary}</code>
            {node.status === 'only'
              ? ` (${onlyHere})`
              : STATUS_WORDS[node.status]}
          </span>
          {node.children.length > 0 ? (
            <Outline nodes={node.children} onlyHere={onlyHere} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Side({
  id,
  title,
  onlyHere,
  typeLabels,
  nodes,
}: SideProps): React.ReactElement {
  return (
    <section aria-labelledby={id} className="cms-pattern-review-side">
      <h4 id={id}>{title}</h4>
      <p>
        Content types:{' '}
        {typeLabels.length === 0 ? 'none' : typeLabels.join(', ')}
      </p>
      <Outline nodes={nodes} onlyHere={onlyHere} />
    </section>
  );
}

/**
 * Review changes (FE03 :1216): the newer saved version beside the preserved draft,
 * read-only, with every node marked as only on one side or changed. Rebasing and
 * discarding stay the explicit choices that follow it.
 */
export default function CmsPatternReview({
  latest,
  draftTree,
  draftTypeIds,
  context,
}: Props): React.ReactElement {
  const theirs = outlineFromWire(latest.blockTree);
  const mine = outlineFromEditable(draftTree);
  return (
    <div className="cms-pattern-review">
      <h4>Review changes</h4>
      <p>
        Read-only comparison of version {latest.version} with the tree and
        content types you have not saved. Nodes are matched by key at the same
        position.
      </p>
      <div className="cms-pattern-review-sides">
        <Side
          id="cms-pattern-review-latest"
          title={`Version ${latest.version} (newer, saved by someone else or in another tab)`}
          onlyHere={`only in version ${latest.version}`}
          typeLabels={typeChoiceLabels(latest.compatibleTypeIds, context)}
          nodes={annotateOutline(theirs, mine)}
        />
        <Side
          id="cms-pattern-review-draft"
          title="Your unsent draft"
          onlyHere="only in your draft"
          typeLabels={typeChoiceLabels(draftTypeIds, context)}
          nodes={annotateOutline(mine, theirs)}
        />
      </div>
    </div>
  );
}
