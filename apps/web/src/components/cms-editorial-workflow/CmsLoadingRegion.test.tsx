// @vitest-environment jsdom
import * as React from 'react';
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
import CmsLoadingRegion, { useLoadingDelay } from './CmsLoadingRegion';
import { useCanonicalResource } from './use-cms-workflow-canonical';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/*
 * FE03 46 and 912 (loading: "Navigation/refetch exceeds 250 ms") and the Slice 12 definition governance states (1042 to 1048,
 * P2-S12-AC-271): a known layout shows a skeleton only after 250 ms, in a polite region; a read that finishes sooner never flashes
 * one. The one place is `useLoadingDelay`; `CmsLoadingRegion` (same module) renders it; `useCanonicalResource` exposes it as `loading`.
 */
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const Probe = ({ active }: { readonly active: boolean }) => (
  <output data-testid="shown">{String(useLoadingDelay(active))}</output>
);
const shown = (container: HTMLElement): string | null =>
  container.querySelector('[data-testid="shown"]')?.textContent ?? null;

describe('useLoadingDelay', () => {
  it('is false at 249 ms and true at 250 ms of continuous activity', async () => {
    const { container } = mountElement(<Probe active />);
    expect(shown(container)).toBe('false');
    await advance(249);
    expect(shown(container)).toBe('false');
    await advance(1);
    expect(shown(container)).toBe('true');
  });

  it('is never true for an activity that ends before 250 ms, and restarts its clock on the next one', async () => {
    const view = mountElement(<Probe active />);
    await advance(249);
    view.rerender(<Probe active={false} />);
    await advance(1_000);
    expect(shown(view.container)).toBe('false');
    view.rerender(<Probe active />);
    await advance(249);
    expect(shown(view.container)).toBe('false');
    await advance(1);
    expect(shown(view.container)).toBe('true');
    view.rerender(<Probe active={false} />);
    expect(shown(view.container)).toBe('false');
  });

  it('arms no timer when idle and clears it on unmount', async () => {
    const idle = mountElement(<Probe active={false} />);
    expect(vi.getTimerCount()).toBe(0);
    idle.unmount();
    const busy = mountElement(<Probe active />);
    expect(vi.getTimerCount()).toBe(1);
    busy.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('CmsLoadingRegion', () => {
  it('renders nothing at 249 ms, then one polite status line with the label at 250 ms', async () => {
    const { container } = mountElement(
      <CmsLoadingRegion active label="Loading the current review" />,
    );
    await advance(249);
    expect(container.innerHTML).toBe('');
    await advance(1);
    const region = container.querySelector('[role="status"]') as HTMLElement;

    expect(region.textContent).toContain('Loading the current review');
  });

  it('renders nothing while inactive', async () => {
    const { container } = mountElement(
      <CmsLoadingRegion active={false} label="x" />,
    );
    await advance(1_000);
    expect(container.innerHTML).toBe('');
  });
});

describe('useCanonicalResource: loading', () => {
  type Read = () => Promise<CanonicalReadResult<string>>;
  const Host = ({ read }: { readonly read: Read }) => {
    const canonical = useCanonicalResource(
      'first',
      '2026-01-01T00:00:00Z',
      read,
    );
    return (
      <div>
        <button type="button" onClick={() => void canonical.refetch()}>
          read
        </button>
        <output data-testid="shown">{String(canonical.loading)}</output>
        <output data-testid="data">{canonical.data}</output>
      </div>
    );
  };

  it('is false at 249 ms of a refetch, true at 250 ms, and false again when the read verified', async () => {
    let finish: (value: CanonicalReadResult<string>) => void = () => undefined;
    const read: Read = () => new Promise((resolve) => (finish = resolve));
    const { container } = mountElement(<Host read={read} />);
    expect(shown(container)).toBe('false');
    await act(async () => {
      container.querySelector('button')?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    await advance(249);
    expect(shown(container)).toBe('false');
    await advance(1);
    expect(shown(container)).toBe('true');
    // Prior content stays while it loads.
    expect(container.querySelector('[data-testid="data"]')?.textContent).toBe(
      'first',
    );
    await act(async () => {
      finish({ kind: 'ok', resource: 'second' });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shown(container)).toBe('false');
    expect(container.querySelector('[data-testid="data"]')?.textContent).toBe(
      'second',
    );
  });

  it('never exposes loading for a read that finishes inside 250 ms', async () => {
    const read: Read = async () => ({ kind: 'ok', resource: 'second' });
    const { container } = mountElement(<Host read={read} />);
    await act(async () => {
      container.querySelector('button')?.click();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(shown(container)).toBe('false');
    await advance(1_000);
    expect(shown(container)).toBe('false');
  });
});
