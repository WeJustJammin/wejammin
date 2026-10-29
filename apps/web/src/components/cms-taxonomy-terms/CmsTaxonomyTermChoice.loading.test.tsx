// @vitest-environment jsdom
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermChoice from './CmsTaxonomyTermChoice';
import { organ } from './term-form.test-support';

/*
 * P2-S12-AC-271 (FE03 46 and 912): a page of terms that is still loading after 250 ms shows the loading state, a faster
 * one never flashes it. The paging button keeps its label and does nothing while a page loads.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const choice = (status: 'ready' | 'loading') => (
  <CmsTaxonomyTermChoice
    id="cms-term-parent"
    label="Parent term"
    value=""
    empty="No parent (top level)"
    help="help"
    issues={[]}
    choices={[organ]}
    loader={{ more: true, retry: false, status, load: vi.fn() }}
    onChange={vi.fn()}
  />
);

const region = (container: HTMLElement): string | null =>
  container.querySelector('.cms-loading-region')?.textContent ?? null;

describe('CmsTaxonomyTermChoice loading state', () => {
  it('shows nothing at 249 ms and the loading state at 250 ms of a page read', async () => {
    const { container } = mountElement(choice('loading'));
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(region(container)).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(region(container)).toBe('Loading terms…');
  });

  it('never shows the loading state for a page that arrives before 250 ms', async () => {
    const { container, rerender } = mountElement(choice('loading'));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    rerender(choice('ready'));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(region(container)).toBeNull();
  });

  it('removes the loading state when the page arrives', async () => {
    const { container, rerender } = mountElement(choice('loading'));
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(region(container)).toBe('Loading terms…');
    rerender(choice('ready'));
    expect(region(container)).toBeNull();
  });
});
