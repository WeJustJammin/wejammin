import type { IssueTarget } from './pattern-designer-request';

/** DOM ids of the designer: every error summary link points at one of these. */
export const PATTERN_KEY_ID = 'cms-pattern-key';
export const PATTERN_TYPES_ID = 'cms-pattern-types';
export const PATTERN_TREE_ID = 'cms-pattern-tree';
export const PATTERN_FORM_ID = 'cms-pattern-form';
export const PATTERN_STATUS_ID = 'cms-pattern-status';
export const PATTERN_RESULT_HEADING_ID = 'cms-pattern-result-heading';

export const nodeDomId = (uiId: string, part?: string): string =>
  `cms-pattern-node-${uiId}${part === undefined ? '' : `-${part}`}`;

/** The control a summary link focuses for an issue target. */
export const targetDomId = (target: IssueTarget): string => {
  if (target.kind === 'field')
    return target.field === 'patternKey'
      ? PATTERN_KEY_ID
      : target.field === 'compatibleTypeIds'
        ? PATTERN_TYPES_ID
        : target.field === 'tree'
          ? PATTERN_TREE_ID
          : PATTERN_FORM_ID;
  switch (target.member) {
    case 'key':
      return nodeDomId(target.uiId, 'key');
    case 'blockRef':
      return nodeDomId(target.uiId, 'block');
    case 'props':
      return nodeDomId(target.uiId, 'props');
    case 'children':
      return nodeDomId(target.uiId, 'add');
    default:
      return nodeDomId(target.uiId);
  }
};

/** "1", "1.2", "1.2.3": the 1-based position of a node path, as shown and announced. */
export const nodeNumber = (path: readonly number[]): string =>
  path.map((index) => index + 1).join('.');
