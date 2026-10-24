import type { PatternSummaryItem } from './CmsPatternStatus';
import type { IssueField } from './pattern-designer-request';

export interface GroupedItems {
  readonly byNode: ReadonlyMap<string, readonly PatternSummaryItem[]>;
  readonly byField: Readonly<Record<IssueField, readonly PatternSummaryItem[]>>;
}

/** Sort the summary items to the control that owns each, so an error shows beside it. */
export const groupItems = (
  items: readonly PatternSummaryItem[],
): GroupedItems => {
  const byNode = new Map<string, PatternSummaryItem[]>();
  const byField: Record<IssueField, PatternSummaryItem[]> = {
    patternKey: [],
    compatibleTypeIds: [],
    tree: [],
    form: [],
  };
  for (const item of items) {
    if (item.target.kind === 'field') byField[item.target.field].push(item);
    else
      byNode.set(item.target.uiId, [
        ...(byNode.get(item.target.uiId) ?? []),
        item,
      ]);
  }
  return { byNode, byField };
};
