// @vitest-environment jsdom
import { act } from 'react';
import * as React from 'react';
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
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  TERM_ACTION_LOADING_COPY,
  createLazyTermAction,
  type TermActionProps,
} from './term-action-view';

/*
 * The term action form loads when the person opens an action. The three states of that load: a slow load shows the
 * loading state after 250 ms and never before (P2-S12-AC-271, FE03 46 and 912), a fast one shows none, and a chunk
 * that cannot be fetched keeps the page and imports again on the person's retry. jsdom has no module map, so the
 * retry proves that a second `view()` call is made; `lib/retryable-import.test.ts` proves the real-URL retry and the
 * real-route spec `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts` (T7) proves it in Chrome.
 */
const props = {} as TermActionProps;
const FORM_MARKER = 'term action form loaded';
const Loaded = (): React.ReactElement => <p>{FORM_MARKER}</p>;

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const loadingText = (container: HTMLElement): string | null =>
  container.querySelector('.cms-loading-region')?.textContent ?? null;

type Module = { readonly default: React.ComponentType<TermActionProps> };

describe('the lazy term action form', () => {
  it('shows no loading state at 249 ms and the state at 250 ms, then the form once it arrives', async () => {
    let arrive: (module: Module) => void = () => undefined;
    const Lazy = createLazyTermAction(
      () =>
        new Promise<Module>((resolve) => {
          arrive = resolve;
        }),
    );
    const { container } = mountElement(<Lazy {...props} />);
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(loadingText(container)).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loadingText(container)).toBe(TERM_ACTION_LOADING_COPY);
    await act(async () => arrive({ default: Loaded }));
    await flush();
    expect(container.textContent).toContain(FORM_MARKER);
    expect(loadingText(container)).toBeNull();
  });

  it('shows no loading state at all when the form arrives before 250 ms', async () => {
    const Lazy = createLazyTermAction(async () => ({ default: Loaded }));
    const { container } = mountElement(<Lazy {...props} />);
    await flush();
    expect(container.textContent).toContain(FORM_MARKER);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(loadingText(container)).toBeNull();
  });

  it('keeps the page when the chunk cannot be fetched, and imports again on the retry', async () => {
    vi.useRealTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi
      .fn<() => Promise<Module>>()
      .mockRejectedValueOnce(
        new Error('Failed to fetch dynamically imported module'),
      )
      .mockResolvedValue({ default: Loaded });
    const Lazy = createLazyTermAction(load);
    const { container } = mountElement(
      <div>
        <h2>Terms</h2>
        <Lazy {...props} />
      </div>,
    );
    await flush();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be loaded',
    );
    expect(container.querySelector('h2')?.textContent).toBe('Terms');
    expect(load).toHaveBeenCalledTimes(1);
    await click(buttonNamed(container, 'Try loading this form again'));
    await flush();
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(FORM_MARKER);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
