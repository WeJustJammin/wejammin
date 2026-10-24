import { useCallback, useMemo, useState } from 'react';

import type { PatternSummaryItem } from './CmsPatternStatus';
import {
  PATTERN_ISSUE_COPY,
  type DesignerIssueCode,
} from './pattern-designer-copy';
import { PATTERN_KEY_ID, nodeDomId } from './pattern-designer-ids';
import type { IssueTarget, NodeMember } from './pattern-designer-request';
import {
  isPatternNodeKey,
  patternKeyIssue,
  propsIssue,
} from './pattern-tree-rules';
import {
  parseProps,
  type EditableNode,
  type EditableTree,
} from './pattern-tree-state';

const item = (
  code: DesignerIssueCode,
  target: IssueTarget,
): PatternSummaryItem => ({ message: PATTERN_ISSUE_COPY[code], target });

const nodeTarget = (uiId: string, member: NodeMember): IssueTarget => ({
  kind: 'node',
  uiId,
  member,
});

/** The syntax issue of one block's props text, or null. */
const propsCode = (text: string): DesignerIssueCode | null => {
  const parsed = parseProps(text);
  return parsed.ok ? propsIssue(parsed.value) : parsed.code;
};

const nodeItems = (
  nodes: readonly EditableNode[],
  visited: ReadonlySet<string>,
): PatternSummaryItem[] =>
  nodes.flatMap((node) => {
    const own: PatternSummaryItem[] = [];
    if (visited.has(nodeDomId(node.uiId, 'key')) && !isPatternNodeKey(node.key))
      own.push(item('node_key_invalid', nodeTarget(node.uiId, 'key')));
    if (node.kind === 'block' && visited.has(nodeDomId(node.uiId, 'props'))) {
      const code = propsCode(node.propsText);
      if (code !== null) own.push(item(code, nodeTarget(node.uiId, 'props')));
    }
    return [...own, ...nodeItems(node.children, visited)];
  });

/**
 * Errors of the controls the person has already left, never before (FE03 form contract, :1223:
 * syntax and safe local constraints on blur, cross-field on review/submit, no pre-visit error).
 * A control is judged once its `blur` was seen and again on every change after that, so a
 * corrected value clears its error. Only syntax of one control is checked here: the pattern key,
 * a node key and a node's props. Duplicate sibling keys, the block registry, the content types
 * and the empty tree are cross-field and stay with the submit.
 *
 * `onBlur` belongs on the form element (React delegates blur as it bubbles): the visited
 * control is told apart by its DOM id, so no control needs a handler of its own.
 */
export const usePatternBlurValidation = (
  patternKey: string,
  tree: EditableTree,
) => {
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  const onBlur = useCallback((event: React.FocusEvent<HTMLElement>): void => {
    const id = event.target.id;
    if (id === '') return;
    setVisited((current) =>
      current.has(id) ? current : new Set(current).add(id),
    );
  }, []);
  const items = useMemo((): PatternSummaryItem[] => {
    if (visited.size === 0) return [];
    const keyIssue = visited.has(PATTERN_KEY_ID)
      ? patternKeyIssue(patternKey.trim())
      : null;
    return [
      ...(keyIssue === null
        ? []
        : [item(keyIssue, { kind: 'field', field: 'patternKey' })]),
      ...nodeItems(tree, visited),
    ];
  }, [patternKey, tree, visited]);
  return { items, onBlur };
};
