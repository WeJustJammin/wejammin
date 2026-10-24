/*
 * Virtualization of the instance list above 100 rows (FE03 887; Performance budgets, the
 * `CompositionTaxonomyLocalizationWorkbench` row). Rows have one fixed height so the window is arithmetic; the full
 * height is kept by two spacers so the scroll bar and the stable `aria-posinset` stay true.
 */
export const VIRTUALIZE_ABOVE = 100;
export const ROW_HEIGHT_PX = 72;
const VIEWPORT_ROWS = 12;
const OVERSCAN_ROWS = 12;

export interface RowWindow {
  readonly windowed: boolean;
  readonly start: number;
  readonly end: number;
  readonly before: number;
  readonly after: number;
}

export const windowFor = (count: number, scrollTop: number): RowWindow => {
  if (count <= VIRTUALIZE_ABOVE)
    return { windowed: false, start: 0, end: count, before: 0, after: 0 };
  const first = Math.floor(Math.max(0, scrollTop) / ROW_HEIGHT_PX);
  const start = Math.max(0, Math.min(first - OVERSCAN_ROWS, count - 1));
  const end = Math.min(count, first + VIEWPORT_ROWS + OVERSCAN_ROWS);
  return {
    windowed: true,
    start,
    end: Math.max(end, start),
    before: start * ROW_HEIGHT_PX,
    after: (count - Math.max(end, start)) * ROW_HEIGHT_PX,
  };
};
