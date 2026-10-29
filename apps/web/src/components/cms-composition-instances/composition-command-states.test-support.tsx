import { act } from 'react';
import { expect } from 'vitest';

import { byLabel } from '../cms-editorial-fields/cms-editor-dom.test-support';

/*
 * Shared cell drivers of the `commandState` column of the Slice 12 state table (FE03 "Slice 12 definition governance
 * states", P2-S12-AC-271) for the composition commands CMS-03C-02 (place) and CMS-03C-15 (accept, detach). The page is
 * the REAL island over a scripted wire (`composition-page.test-support.tsx`).
 */

/** A reply the test answers by hand, as a fetch that is still in flight. */
export const heldReply = () => {
  let answer: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => (answer = resolve));
  return { reply: (() => promise) as unknown as () => Response, answer };
};

/** Settle a held reply inside `act`. */
export const answerHeld = async (
  held: ReturnType<typeof heldReply>,
  response: Response,
): Promise<void> => {
  await act(async () => {
    held.answer(response);
    await Promise.resolve();
    await Promise.resolve();
  });
};

export const resultRegion = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-composition-status');

export const resultText = (container: HTMLElement): string =>
  resultRegion(container)?.textContent ?? '';

export const resultHeading = (container: HTMLElement): string =>
  container.querySelector('#cms-composition-result-heading')?.textContent ?? '';

/** Every control of the container that carries a `disabled` attribute, other than the named commit controls. */
export const disabledBesides = (
  container: HTMLElement,
  ...commit: HTMLElement[]
): string[] =>
  [
    ...container.querySelectorAll<HTMLElement>(
      'input, textarea, select, button, fieldset',
    ),
  ]
    .filter(
      (control) =>
        !commit.includes(control) && control.hasAttribute('disabled'),
    )
    .map(
      (control) =>
        control.getAttribute('aria-label') ??
        (control.id || control.textContent || control.tagName),
    );

/** The pending cell of a composition command: a polite status carries the stable label. */
export const expectPendingLabel = (
  container: HTMLElement,
  label: string,
): void => {
  const region = resultRegion(container);
  expect(region?.getAttribute('role')).toBe('status');
  expect(region?.textContent).toBe(label);
};

export const pattern = (container: HTMLElement): HTMLSelectElement =>
  byLabel<HTMLSelectElement>(container, 'Pattern');
