// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CmsRegistryChangeNotice from './CmsRegistryChangeNotice';
import type { RegistryReadState } from './registry-read-types';

/*
 * Review V20 m8: the polite region of the read result exists, empty, before its content (a live region inserted
 * together with its text is not reliably announced). The same mounted node receives the text.
 */
const roots: ReturnType<typeof createRoot>[] = [];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const mount = () => {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  roots.push(root);
  const render = (state: RegistryReadState): Promise<void> =>
    act(async () =>
      root.render(
        <CmsRegistryChangeNotice
          state={state}
          waiting={false}
          onRead={() => undefined}
        />,
      ),
    );
  return { container, render, root };
};
const region = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-registry-change]');

describe('CmsRegistryChangeNotice polite region', () => {
  it('is mounted empty and polite before any read', async () => {
    const { container, render } = mount();
    await render({ kind: 'none' });
    const node = region(container);
    expect(node).not.toBeNull();
    expect(node?.textContent).toBe('');
    expect(node?.getAttribute('role')).toBe('status');
    expect(node?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('section[aria-label]')).toBeNull();
  });

  it('writes the lines into the same node after the read, and clears them for a new read', async () => {
    const { container, render } = mount();
    await render({ kind: 'none' });
    const node = region(container);
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    );
    observer.observe(node!, { childList: true, subtree: true });
    await render({ kind: 'checking' });
    expect(node?.textContent).toBe('');
    await render({ kind: 'read', lines: ['one', 'Added: a@2'] });
    await Promise.resolve();
    expect(region(container)).toBe(node);
    expect(node?.textContent).toBe('one Added: a@2');
    expect(mutations.length).toBeGreaterThan(0);
    await render({ kind: 'checking' });
    expect(node?.textContent).toBe('');
    observer.disconnect();
  });

  it('keeps the mounted node through a failed read and a repeat that succeeds', async () => {
    const { container, render } = mount();
    await render({ kind: 'none' });
    const node = region(container);
    await render({
      kind: 'failed',
      message: 'The block choices could not be read.',
      rateLimited: false,
    });
    expect(region(container)).toBe(node);
    expect(node?.textContent).toBe('');
    await render({ kind: 'checking' });
    await render({ kind: 'read', lines: ['The block choices are unchanged.'] });
    expect(region(container)).toBe(node);
    expect(node?.textContent).toBe('The block choices are unchanged.');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Block registry',
    );
  });
});
