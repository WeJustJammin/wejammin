import { vi } from 'vitest';
import { expect } from 'vitest';

import {
  governedApiError,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';

/*
 * Shared cell drivers of the `commandState` column of the Slice 12 state table (FE03 "Slice 12 definition governance
 * states", P2-S12-AC-271) for the governed command forms (CMS-03C-06 to -09). A refusal here is the REAL wire answer
 * of the BE03c catalog, so the real transport, classifier and frame produce the copy under test.
 */

export const failureResponse = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(status, governedApiError(code, 'A fixed message.', details));

export const stepUpRequired = (): Response =>
  failureResponse(401, 'STEP_UP_REQUIRED', {
    recoveryAction: 'step_up',
    allowedMethods: ['totp'],
  });

export const forbiddenFor = (reasonCode: string): Response =>
  failureResponse(403, 'GOVERNED_REVIEW_FORBIDDEN', { reasonCode });

export const conflictFor = (reasonCode: string): Response =>
  failureResponse(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode });

export const invalidFor = (
  reasonCode: string,
  extra: Record<string, unknown> = {},
): Response =>
  failureResponse(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
    reasonCode,
    ...extra,
  });

/** A wire that holds the command in flight until the test settles it. */
export const heldWire = () => {
  let settle: (response: Response) => void = () => undefined;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        settle = resolve;
      }),
  );
  return { fetcher, settle: (response: Response) => settle(response) };
};

/** A canonical re-read the test releases: `release(true)` is a verified read. */
export const heldReread = () => {
  let release: (verified: boolean) => void = () => undefined;
  const refetch = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
  );
  return { refetch, release: (verified: boolean) => release(verified) };
};

export const GATE = '[data-cms-editorial-capability-gate]';

export const statusOf = (container: HTMLElement): string =>
  container.querySelector('[data-cms-workflow-status=""]')?.textContent ?? '';

export const alertOf = (container: HTMLElement): string =>
  container.querySelector('[role="alert"]')?.textContent ?? '';

export const WAITING =
  'The result could not be confirmed. Checking the current state before you retry.';
export const RECONCILED =
  'The current state is loaded. You can retry the same request.';

/** Every control of the container that is disabled or aria-disabled, other than the commit control. */
export const disabledBesides = (
  container: HTMLElement,
  commit: HTMLElement,
): string[] =>
  [
    ...container.querySelectorAll<HTMLElement>(
      'input, textarea, select, button',
    ),
  ]
    .filter(
      (control) =>
        control !== commit &&
        (control.hasAttribute('disabled') ||
          control.getAttribute('aria-disabled') === 'true'),
    )
    .map((control) => control.id || control.textContent || control.tagName);

/** The pending cell: the commit control (and only it) is disabled, busy and keeps its label. */
export const expectOnlyCommitDisabled = (
  container: HTMLElement,
  commit: HTMLButtonElement,
  label: string,
  pendingLabel: string,
): void => {
  expect(statusOf(container)).toBe(pendingLabel);
  expect(commit.textContent).toBe(label);
  expect(commit.getAttribute('aria-disabled')).toBe('true');
  expect(commit.getAttribute('aria-busy')).toBe('true');
  expect(disabledBesides(container, commit)).toEqual([]);
};

/** A 401 STEP_UP_REQUIRED leaves for the verification page and renders neither a gate nor a refusal. */
export const expectStepUpRoute = (
  container: HTMLElement,
  navigate: ReturnType<typeof vi.fn>,
  fetcher: ReturnType<typeof vi.fn>,
  frame: HTMLElement = container,
): void => {
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(container.querySelector(GATE)).toBeNull();
  expect(container.querySelector('a[href*="sign-in"]')).toBeNull();
  expect(statusOf(frame)).toBe('Opening verification…');
};
