import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';

import {
  ConsoleUnderTest,
  jsonResponse,
} from './cms-capability-grant-console.test-support';
import type { CmsCapabilityGrantConsoleProps } from './cms-capability-grant-types';

export interface Mounted {
  readonly container: HTMLDivElement;
  readonly unmount: () => void;
}

/** Mount the island into the jsdom document inside act(). */
export const mountConsole = (
  props: CmsCapabilityGrantConsoleProps,
): Mounted => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(ConsoleUnderTest, props)));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

export interface FetchCall {
  readonly url: string;
  readonly method: string;
  readonly body: FormData | null;
}

export type Responder = (call: FetchCall) => Response | Promise<Response>;

/** A scripted fetch: each call takes the next responder (the last repeats). */
export const scriptFetch = (...responders: Responder[]) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: FetchCall = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body instanceof FormData ? init.body : null,
      };
      calls.push(call);
      const responder =
        responders[Math.min(calls.length - 1, responders.length - 1)] ??
        (() => jsonResponse(503, {}));
      return responder(call);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
};

/**
 * The timer captured at import time, before any test installs fake timers, so a
 * real macrotask turn is available even under `vi.useFakeTimers()`.
 */
const realSetTimeout = globalThis.setTimeout;
const RESPONSE_BODY_SETTLE_MS = 15;

/**
 * Lets a scripted `fetch` answer, its body stream and React's commit settle. A
 * Response body is finished by real time, not by microtasks, so six microtask
 * turns alone left the pending state visible under load (1 run in 4).
 */
export const settle = async (): Promise<void> => {
  for (let index = 0; index < 6; index += 1)
    await act(async () => {
      await Promise.resolve();
    });
  await act(async () => {
    await new Promise<void>((resolve) => {
      realSetTimeout(resolve, RESPONSE_BODY_SETTLE_MS);
    });
  });
};

const setter = (element: object) =>
  Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype,
    'value',
  )?.set;

type Typeable = EventTarget & { value: string };

export const typeInto = (element: Typeable, value: string): void => {
  act(() => {
    setter(element)?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

export const blur = (element: EventTarget): void => {
  act(() => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
};

export const click = (element: EventTarget | null): void => {
  if (element === null) throw new Error('RED: expected a clickable element');
  act(() => {
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
};

export const submit = async (form: HTMLFormElement): Promise<void> => {
  await act(async () => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
  await settle();
};

/** Anything that can be searched (a Document or any element). */
export interface Scope {
  readonly querySelector: <E = Element>(selectors: string) => E | null;
}

export const query = <T = Element,>(root: Scope, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`RED: expected ${selector}`);
  return found;
};

export const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/gu, ' ').trim();

export const GRANT_UUID = 'f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3';

/** Fill the grant form with a valid grant (jsdom). */
export const fillGrantForm = (
  root: Scope,
  values: {
    person?: string;
    capability?: string;
    validThrough?: string;
    reason?: string;
  } = {},
): HTMLFormElement => {
  const form = query<HTMLFormElement>(
    root,
    'form[data-operation-id="CMS-03A-15"]',
  );
  typeInto(
    query(form, 'input[name="subjectPersonId"]'),
    values.person ?? GRANT_UUID,
  );
  typeInto(
    query(form, 'select[name="capability"]'),
    values.capability ?? 'cms.author',
  );
  typeInto(
    query(form, 'input[name="validThrough"]'),
    values.validThrough ?? '2026-12-30',
  );
  if (values.reason !== undefined)
    typeInto(query(form, 'textarea[name="reason"]'), values.reason);
  return form;
};
