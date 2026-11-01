import * as React from 'react';

import { nodeDomId, nodeNumber } from './pattern-designer-ids';
import type { PatternSummaryItem } from './CmsPatternStatus';
import { PATTERN_LIMITS } from './pattern-tree-rules';
import type { EditableNode } from './pattern-tree-state';

export interface PatternNodeOps {
  readonly update: (
    uiId: string,
    patch: Partial<Omit<EditableNode, 'uiId'>>,
  ) => void;
  readonly move: (uiId: string, direction: -1 | 1) => void;
  readonly remove: (uiId: string) => void;
  readonly addChild: (uiId: string) => void;
  readonly canAddChild: (uiId: string) => boolean;
}

interface Props {
  readonly node: EditableNode;
  /** Child indices from the roots. */
  readonly path: readonly number[];
  readonly siblingCount: number;
  readonly registeredBlocks: ReadonlyArray<{
    readonly blockKey: string;
    readonly blockVersion: number;
  }>;
  readonly issues: readonly PatternSummaryItem[];
  readonly ops: PatternNodeOps;
  readonly children?: React.ReactNode;
}

const memberOf = (item: PatternSummaryItem): string | null =>
  item.target.kind === 'node' ? item.target.member : null;

/** One list item of the pattern tree: its controls, its errors and its nested list. */
export default function CmsPatternNode({
  node,
  path,
  siblingCount,
  registeredBlocks,
  issues,
  ops,
  children,
}: Props): React.ReactElement {
  const index = path[path.length - 1] ?? 0;
  const label = nodeNumber(path);
  const errorsId = nodeDomId(node.uiId, 'errors');
  const describedBy = issues.length > 0 ? errorsId : undefined;
  const invalid = (member: string): true | undefined =>
    issues.some((item) => memberOf(item) === member) ? true : undefined;
  const refs = registeredBlocks.map(
    (block) => `${block.blockKey}@${block.blockVersion}`,
  );
  const retired = node.blockRef !== '' && !refs.includes(node.blockRef);
  return (
    <li id={nodeDomId(node.uiId)} tabIndex={-1}>
      <div role="group" aria-labelledby={nodeDomId(node.uiId, 'title')}>
        <p
          id={nodeDomId(node.uiId, 'title')}
          className="cms-pattern-node-title"
        >
          <strong>Node {label}</strong>
          <span>
            {' '}
            · Level {path.length} of {PATTERN_LIMITS.depth} · {index + 1} of{' '}
            {siblingCount} at this level
          </span>
        </p>
        <label htmlFor={nodeDomId(node.uiId, 'key')}>Node {label} key</label>
        <input
          id={nodeDomId(node.uiId, 'key')}
          value={node.key}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid('key')}
          aria-describedby={describedBy}
          onChange={(event) =>
            ops.update(node.uiId, { key: event.currentTarget.value })
          }
        />
        {node.kind === 'block' ? (
          <>
            <label htmlFor={nodeDomId(node.uiId, 'block')}>
              Node {label} block
            </label>
            <select
              id={nodeDomId(node.uiId, 'block')}
              value={node.blockRef}
              aria-invalid={invalid('blockRef')}
              aria-describedby={describedBy}
              onChange={(event) =>
                ops.update(node.uiId, { blockRef: event.currentTarget.value })
              }
            >
              <option value="">Choose a registered block</option>
              {retired ? (
                <option value={node.blockRef}>
                  {node.blockRef} (no longer registered)
                </option>
              ) : null}
              {refs.map((ref) => (
                <option key={ref} value={ref}>
                  {ref}
                </option>
              ))}
            </select>
            <label htmlFor={nodeDomId(node.uiId, 'props')}>
              Node {label} props (JSON object)
            </label>
            <textarea
              id={nodeDomId(node.uiId, 'props')}
              value={node.propsText}
              rows={4}
              spellCheck={false}
              aria-invalid={invalid('props')}
              aria-describedby={`${nodeDomId(node.uiId, 'props-help')}${describedBy === undefined ? '' : ` ${describedBy}`}`}
              onChange={(event) =>
                ops.update(node.uiId, { propsText: event.currentTarget.value })
              }
            />
            <small id={nodeDomId(node.uiId, 'props-help')}>
              Data only: text, numbers, true, false, null, lists and objects. At
              most {PATTERN_LIMITS.propsKeys} keys and{' '}
              {PATTERN_LIMITS.propsDepth} levels.
            </small>
          </>
        ) : (
          <p>
            Nested pattern <code>{node.patternId}</code>, version{' '}
            {node.patternVersion}. It is kept as saved; it can be moved or
            removed here but not edited.
          </p>
        )}
        {issues.length > 0 ? (
          <ul id={errorsId} className="cms-field-errors">
            {issues.map((item) => (
              <li key={item.message}>{item.message}</li>
            ))}
          </ul>
        ) : null}
        <div className="cms-pattern-node-actions">
          <button
            type="button"
            id={nodeDomId(node.uiId, 'up')}
            disabled={index === 0}
            onClick={() => ops.move(node.uiId, -1)}
          >
            Move node {label} earlier
          </button>
          <button
            type="button"
            id={nodeDomId(node.uiId, 'down')}
            disabled={index === siblingCount - 1}
            onClick={() => ops.move(node.uiId, 1)}
          >
            Move node {label} later
          </button>
          <button
            type="button"
            id={nodeDomId(node.uiId, 'remove')}
            onClick={() => ops.remove(node.uiId)}
          >
            Remove node {label}
          </button>
          {node.kind === 'block' ? (
            <button
              type="button"
              id={nodeDomId(node.uiId, 'add')}
              disabled={!ops.canAddChild(node.uiId)}
              onClick={() => ops.addChild(node.uiId)}
            >
              Add a child block to node {label}
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </li>
  );
}
