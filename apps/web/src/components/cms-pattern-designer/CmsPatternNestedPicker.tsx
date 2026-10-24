import * as React from 'react';

export const NESTED_PICKER_DISABLED_REASON =
  'The list of patterns you can nest is not available yet, so a nested pattern cannot be added here. A nested pattern already in a saved version is kept and can be moved or removed.';

/**
 * BOUNDARY: the nested-pattern picker is `CmsPatternSelector`, which reads CMS-03C-13
 * (`GET /api/v1/cms/patterns/selector`). That Worker route and its proxy are not
 * built, so this control is disabled and names why (FE03 Slice 12 states: the
 * disabled state names the missing prerequisite). It offers no hand-typed pattern id.
 */
export default function CmsPatternNestedPicker(): React.ReactElement {
  return (
    <div className="cms-pattern-nested-picker">
      <label htmlFor="cms-pattern-nested-select">Add a nested pattern</label>
      <select
        id="cms-pattern-nested-select"
        disabled
        aria-describedby="cms-pattern-nested-reason"
      >
        <option>No pattern can be chosen yet</option>
      </select>
      <button
        type="button"
        disabled
        aria-describedby="cms-pattern-nested-reason"
      >
        Add nested pattern
      </button>
      <small id="cms-pattern-nested-reason">
        {NESTED_PICKER_DISABLED_REASON}
      </small>
    </div>
  );
}
