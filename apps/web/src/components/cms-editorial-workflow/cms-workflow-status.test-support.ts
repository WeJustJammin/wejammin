/**
 * Drivers for the FE03 "announce status" rows of the Slice 11 command forms: a
 * confirmation must reach a polite live region that outlives the form that
 * produced it, exactly once.
 */

const matches = (text: string, expected: string | RegExp): boolean =>
  typeof expected === 'string' ? text === expected : expected.test(text);

/** Every polite status region under `root` that currently reads `expected`. */
export const regionsReading = (
  root: HTMLElement,
  expected: string | RegExp,
): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>('[role="status"]')].filter((region) =>
    matches((region.textContent ?? '').trim(), expected),
  );

/** The island's own confirmation region: a polite status line that belongs to no form. */
export const islandStatus = (root: HTMLElement): HTMLElement | null =>
  root.querySelector<HTMLElement>('[data-cms-workflow-status="island"]');

/** The text a region reads right now, trimmed. */
export const readingOf = (region: HTMLElement | null): string =>
  (region?.textContent ?? '').trim();

/** The polite status line a form keeps for itself (pending, restored, unknown). */
export const formStatuses = (root: HTMLElement): string[] =>
  [
    ...root.querySelectorAll(
      '[data-cms-workflow-form] [data-cms-workflow-status]',
    ),
  ]
    .map((status) => (status.textContent ?? '').trim())
    .filter((text) => text !== '');
