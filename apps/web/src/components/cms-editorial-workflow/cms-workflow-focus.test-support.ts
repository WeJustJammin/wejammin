import { act } from 'react';
import { expect, vi } from 'vitest';

import { flush } from '../cms-editorial-fields/cms-editor-dom.test-support';

/**
 * Shared drivers for the focus rules of FE03 ("focus stays until navigation or
 * named result heading", "keep focus on refetch"): a request that never answers,
 * one whose answer is lost, and a read the test releases by hand, so a rule is
 * observed in the window where a command or a refetch is in flight.
 */
export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** A command that never answers: it is in flight for the whole test. */
export const hangingFetcher = () =>
  vi.fn<Fetcher>(() => new Promise<Response>(() => undefined));

/** A command whose answer is lost on the wire: an unknown outcome. */
export const lostFetcher = () =>
  vi.fn<Fetcher>(async () => {
    throw new TypeError('Failed to fetch');
  });

/** A command answered once with `response()`. */
export const answeringFetcher = (response: () => Response) =>
  vi.fn<Fetcher>(async () => response());

/** Lets every promise chain and React update that is already queued finish. */
export const settle = async (): Promise<void> => {
  await act(async () => {
    for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
  });
};

/** Releases a read the test is holding and lets what follows it run. */
export const release = async <T>(
  pending: Deferred<T>,
  value: T,
): Promise<void> => {
  await act(async () => {
    pending.resolve(value);
  });
  await settle();
};

/** Moves focus as a person would (Tab or a click) and proves it landed. */
export const focusOn = <T extends HTMLElement>(element: T): T => {
  element.focus();
  expect(document.activeElement).toBe(element);
  return element;
};

/**
 * Opens a collapsed form as a person does, and lets it load. `scope` is the
 * `<details>` itself or an element whose first `<details>` is the one to open.
 */
export const openDetails = async (scope: HTMLElement): Promise<void> => {
  const details = (
    scope.tagName === 'DETAILS' ? scope : scope.querySelector('details')
  ) as HTMLDetailsElement;
  details.open = true;
  await act(async () => {
    details.dispatchEvent(new Event('toggle'));
  });
  await flush();
};
