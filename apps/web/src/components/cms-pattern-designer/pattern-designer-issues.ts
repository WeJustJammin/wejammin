import type { PatternFormStatus, PatternSummaryItem } from './CmsPatternStatus';
import { targetDomId } from './pattern-designer-ids';
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

/**
 * The submit summary joined with the errors of visited controls (blur), sorted to the control that owns each. A problem
 * shown twice is shown once.
 */
export const groupSummary = (
  status: PatternFormStatus,
  blurItems: readonly PatternSummaryItem[],
): GroupedItems => {
  const submitted =
    status.kind === 'invalid' || status.kind === 'result' ? status.items : [];
  return groupItems([
    ...submitted,
    ...blurItems.filter(
      (blurred) =>
        !submitted.some(
          (entry) =>
            entry.message === blurred.message &&
            targetDomId(entry.target) === targetDomId(blurred.target),
        ),
    ),
  ]);
};
