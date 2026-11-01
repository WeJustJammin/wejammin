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

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CandidateFetch } from './related-candidates';
import { candidate, id, mount, text } from './related-content.test-support';
import { useRelatedCandidates } from './use-related-candidates';
import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/*
 * FE03 :1172: a rate-limited candidate read waits for Retry-After, announces the wait politely and keeps
 * the person's input (their pins and exclusions).
 */
const first = { items: [candidate(1), candidate(2)], nextCursor: 'c1' };
const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const limited = (retryAfterSeconds: number | null): CandidateFetch => ({
  kind: 'rate_limited',
  retryAfterSeconds,
});
const mountWith = (...answers: CandidateFetch[]) => {
  const queue = [...answers];
  const loadPage = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected read');
    return next;
  });
  return {
    ...mount({ candidates: first, loadPage: loadPage as never }),
    loadPage,
  };
};
const settle = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const more = (container: HTMLElement): HTMLButtonElement =>
  buttonNamed(container, 'Load more entries');
const notice = (container: HTMLElement): string =>
  container.querySelector('.cms-related-candidates [role="status"]')
    ?.textContent ?? '';

describe('Load more after a 429', () => {
  it('announces the stated wait politely, keeps the pins, and re-enables the button once the wait elapsed', async () => {
    const { container, loadPage } = mountWith(limited(5), {
      kind: 'page',
      page: { items: [candidate(3)], nextCursor: null },
    });
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await click(more(container));
    await settle(0);
    expect(notice(container)).toContain(rateLimitMessage(5));
    expect(more(container).disabled).toBe(true);
    expect(
      container.querySelector('ol.cms-related-rows li code')?.textContent,
    ).toBe(id(1));
    await settle(4_999);
    expect(more(container).disabled).toBe(true);
    await click(more(container));
    expect(loadPage).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(more(container).disabled).toBe(false);
    await click(more(container));
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(loadPage).toHaveBeenLastCalledWith('c1', expect.any(String));
    expect(text(container)).toContain('(3 loaded)');
    expect(text(container)).not.toContain('Too many requests');
  });

  it('asks for a moment, and leaves the button available, when no wait was stated', async () => {
    const { container } = mountWith(limited(null));
    await click(more(container));
    await settle(0);
    expect(notice(container)).toContain(rateLimitMessage(null));
    expect(more(container).disabled).toBe(false);
  });

  it('is announced in a polite status region, not an alert', async () => {
    const { container } = mountWith(limited(8));
    await click(more(container));
    await settle(0);
    const region = container.querySelector(
      '.cms-related-candidates [role="status"]',
    );
    expect(region?.getAttribute('role')).toBe('status');
    expect(
      container.querySelector('.cms-related-candidates [role="alert"]'),
    ).toBeNull();
  });

  it('retries a limited restart read from the first page, not from a stale cursor', async () => {
    const { container, loadPage } = mountWith(
      { kind: 'restart' },
      limited(null),
      { kind: 'page', page: { items: [candidate(9)], nextCursor: null } },
    );
    await click(more(container));
    await click(buttonNamed(container, 'Reload the list'));
    await settle(0);
    expect(notice(container)).toContain(rateLimitMessage(null));
    await click(buttonNamed(container, 'Reload the list'));
    expect(loadPage).toHaveBeenLastCalledWith(null, expect.any(String));
  });
});

describe('the candidate hook during a 429 wait', () => {
  it('ignores a direct Load more call until the wait elapsed', async () => {
    const loadPage = vi.fn(async () => limited(3));
    const probe: { hook: ReturnType<typeof useRelatedCandidates> | null } = {
      hook: null,
    };
    const Probe = () => {
      probe.hook = useRelatedCandidates({
        entryId: 'e',
        initial: first,
        loadPage: loadPage as never,
      });
      return null;
    };
    mountElement(<Probe />);
    await act(async () => {
      await probe.hook?.loadMore();
    });
    expect(loadPage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await probe.hook?.loadMore();
    });
    expect(loadPage).toHaveBeenCalledTimes(1);
    await settle(3_000);
    await act(async () => {
      await probe.hook?.loadMore();
    });
    expect(loadPage).toHaveBeenCalledTimes(2);
  });
});
