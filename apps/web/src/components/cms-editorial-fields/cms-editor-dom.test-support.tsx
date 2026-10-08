import type * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

/**
 * Minimal DOM driver for React components under jsdom. It exercises real
 * native controls (value setter + bubbling input/change events, real clicks),
 * so a test fails when a control is not actually wired, not when a prop name
 * changes.
 */
const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

export const enableReactAct = (): void => {
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
};

export const disableReactAct = (): void => {
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
};

export interface Mounted {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly rerender: (element: React.ReactElement) => void;
  readonly unmount: () => void;
}

const liveMounts = new Set<Mounted>();

export const mountElement = (element: React.ReactElement): Mounted => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const mounted: Mounted = {
    container,
    root,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      liveMounts.delete(mounted);
      act(() => root.unmount());
    },
  };
  liveMounts.add(mounted);
  return mounted;
};

/**
 * Unmounts every root `mountElement` created that its test did not unmount, so
 * a component's timers, window listeners and pending effects end with the test
 * that mounted it. A root removed from the document is still a live React
 * root: left alone, an autosave timer can fire after the jsdom environment is
 * gone and React then reads a missing `window` (an unhandled error that fails
 * the whole run, not the test). Registered once for every file that imports
 * this driver, after that file's own hooks, so it needs no per-file wiring.
 */
export const unmountEveryMountedRoot = (): void => {
  for (const mounted of [...liveMounts]) mounted.unmount();
};

afterEach(unmountEveryMountedRoot);

export const flush = async (): Promise<void> => {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
};

export const byLabel = <T = HTMLElement,>(
  root: HTMLElement,
  name: string | RegExp,
): T => {
  const matches = (text: string): boolean =>
    typeof name === 'string' ? text === name : name.test(text);
  for (const label of Array.from(root.querySelectorAll('label'))) {
    if (!matches((label.textContent ?? '').trim())) continue;
    const forId = label.getAttribute('for');
    const target =
      forId === null
        ? label.querySelector('input, select, textarea')
        : (label.ownerDocument.getElementById(forId) as HTMLElement | null);
    if (target !== null) return target as unknown as T;
  }
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('[aria-label]'),
  ))
    if (matches(element.getAttribute('aria-label') ?? ''))
      return element as unknown as T;
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('[aria-labelledby]'),
  )) {
    const text = (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/u)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (matches(text)) return element as unknown as T;
  }
  throw new Error(`No control labelled ${String(name)}`);
};

export const buttonNamed = (
  root: HTMLElement,
  name: string | RegExp,
): HTMLButtonElement => {
  for (const button of Array.from(root.querySelectorAll('button'))) {
    const text = (
      button.getAttribute('aria-label') ??
      button.textContent ??
      ''
    ).trim();
    if (typeof name === 'string' ? text === name : name.test(text))
      return button;
  }
  throw new Error(`No button named ${String(name)}`);
};

export const typeInto = async (
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): Promise<void> => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

export const choose = async (
  element: HTMLSelectElement,
  value: string,
): Promise<void> => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

export const click = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.click();
  });
};

export const press = async (
  element: HTMLElement,
  key: string,
): Promise<void> => {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  });
};

/** A `<select>` by selector (the workers `Element` typing hides HTMLSelectElement's DOM shape). */
export const selectBy = (
  root: HTMLElement,
  selector: string,
): HTMLSelectElement => {
  const found = root.querySelector(selector);
  if (found === null) throw new Error(`No element matches ${selector}`);
  return found as unknown as HTMLSelectElement;
};
