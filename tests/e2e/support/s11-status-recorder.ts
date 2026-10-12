import { expect, type Page } from '@playwright/test';

/*
 * Slice 11 command forms confirm a committed command in their one polite status
 * line (`[data-cms-workflow-status]`), and FE03 then refetches the workflow or
 * review so the page shows the canonical resource: "the form clears its draft
 * and the workflow, review and queue are refetched". For a command that closes
 * its own form (a decision, a submit, a publish) the refetch removes the form.
 * The island's own polite line then keeps the confirmation (see the a11y-status
 * fix), but the form's line still disappears with the form a few milliseconds
 * after it appeared.
 *
 * A visibility check on the form's line is therefore a race against the refetch;
 * it passes or fails with the speed of the host, not with the behavior. This module
 * records every text the status lines show from a point on, so a spec asserts
 * that the confirmation WAS announced and then asserts the canonical page state
 * that replaced it, and neither assertion depends on timing.
 */

const STATUS_TEXTS_KEY = '__s11WorkflowStatusTexts';

/** Starts recording every non-empty status line text the page shows from now on. */
export const startRecordingStatusTexts = (page: Page): Promise<void> =>
  page.evaluate((key) => {
    const seen: string[] = [];
    Reflect.set(window, key, seen);
    const note = (): void => {
      for (const status of document.querySelectorAll(
        '[data-cms-workflow-status]',
      )) {
        const text = (status.textContent ?? '').trim();
        if (text !== '' && !seen.includes(text)) seen.push(text);
      }
    };
    // A MutationObserver reports every DOM change as it happens, so a status
    // that is replaced before the next animation frame is still recorded.
    new MutationObserver(note).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    note();
  }, STATUS_TEXTS_KEY);

/** The distinct status texts recorded since `startRecordingStatusTexts`, in order of appearance. */
export const recordedStatusTexts = (page: Page): Promise<string[]> =>
  page.evaluate(
    (key) => [...((Reflect.get(window, key) as string[] | undefined) ?? [])],
    STATUS_TEXTS_KEY,
  );

const matches = (text: string, expected: string | RegExp): boolean =>
  typeof expected === 'string' ? text === expected : expected.test(text);

/** Waits until a status line has shown a text equal to (or matching) `expected`; returns that text. */
export const expectStatusAnnounced = async (
  page: Page,
  expected: string | RegExp,
): Promise<string> => {
  await expect
    .poll(
      async () =>
        (await recordedStatusTexts(page)).some((text) =>
          matches(text, expected),
        ),
      {
        message: `a command status line shows ${String(expected)}`,
      },
    )
    .toBe(true);
  const found = (await recordedStatusTexts(page)).find((text) =>
    matches(text, expected),
  );
  if (found === undefined)
    throw new Error(`status ${String(expected)} was recorded but is gone`);
  return found;
};
