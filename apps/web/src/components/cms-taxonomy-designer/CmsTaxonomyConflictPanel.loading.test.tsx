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
import CmsTaxonomyConflictPanel from './CmsTaxonomyConflictPanel';
import type { TaxonomyConflictState } from './use-taxonomy-conflict';

/*
 * P2-S12-AC-271 (FE03 46 and 912): the vocabulary's latest-version check is a read of known layout. Once it has run
 * 250 ms it shows the loading state; a faster one never flashes it. The check button keeps its own label.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const panel = (state: TaxonomyConflictState) => (
  <CmsTaxonomyConflictPanel
    state={state}
    verified={null}
    baseVersion="1"
    newer={false}
    draft={{ shape: '', typeKeys: [], fieldKeys: [], domains: [] }}
    onCheck={vi.fn()}
    onRebase={vi.fn()}
    onDiscard={vi.fn()}
  />
);

const region = (container: HTMLElement): string | null =>
  container.querySelector('.cms-loading-region')?.textContent ?? null;

describe('CmsTaxonomyConflictPanel loading state', () => {
  it('shows nothing at 249 ms and the loading state at 250 ms of a check', async () => {
    const { container } = mountElement(panel({ kind: 'checking' }));
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(region(container)).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(region(container)).toBe('Checking the latest version…');
  });

  it('never shows the loading state for a check that is answered before 250 ms, and removes it when answered', async () => {
    const { container, rerender } = mountElement(panel({ kind: 'checking' }));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    rerender(panel({ kind: 'none' }));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(region(container)).toBeNull();
    rerender(panel({ kind: 'checking' }));
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(region(container)).not.toBeNull();
    rerender(panel({ kind: 'none' }));
    expect(region(container)).toBeNull();
  });
});
