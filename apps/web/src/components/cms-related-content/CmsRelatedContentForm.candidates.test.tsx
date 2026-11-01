// @vitest-environment jsdom
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
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
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CandidateFetch } from './related-candidates';
import {
  PAGE_PATH,
  candidate,
  id,
  mount,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const first = { items: [candidate(1), candidate(2)], nextCursor: 'c1' };
const loader = (...answers: CandidateFetch[]) => {
  let call = 0;
  return vi.fn(async (...args: [string | null, string]) => {
    void args;
    return answers[call++] ?? ({ kind: 'failed' } as CandidateFetch);
  });
};
const ids = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('table tbody th code')).map(
    (code) => code.textContent ?? '',
  );

describe('loading more candidates', () => {
  it('offers Load more only while the list has a next page, and appends the next page', async () => {
    const loadPage = loader({
      kind: 'page',
      page: { items: [candidate(3)], nextCursor: null },
    });
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, 'Load more entries'));
    expect(loadPage).toHaveBeenCalledWith('c1', expect.any(String));
    expect(ids(container)).toEqual([id(1), id(2), id(3)]);
    expect(() => buttonNamed(container, 'Load more entries')).toThrow();
    expect(text(container)).toContain('(3 loaded)');
  });

  it('shows no button on a single page', () => {
    const { container } = mount({
      candidates: { items: [candidate(1)], nextCursor: null },
    });
    expect(() =>
      buttonNamed(container, /Load more|Reload the list/u),
    ).toThrow();
  });

  it('keeps chosen pins when the list restarts after a cursor conflict, and reloads from the first page', async () => {
    const loadPage = loader(
      { kind: 'restart' },
      {
        kind: 'page',
        page: { items: [candidate(2), candidate(9)], nextCursor: null },
      },
    );
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await click(buttonNamed(container, 'Load more entries'));
    expect(text(container)).toContain(
      'The list changed while you were loading it.',
    );
    expect(ids(container)).toEqual([]);
    // The pinned entry is still a pin, with its facts, though the list no longer shows it.
    expect(
      container.querySelector('ol.cms-related-rows li code')?.textContent,
    ).toBe(id(1));
    expect(
      container.querySelector('ol.cms-related-rows li small')?.textContent,
    ).toContain('en-US');
    await click(buttonNamed(container, 'Reload the list'));
    expect(loadPage).toHaveBeenLastCalledWith(null, expect.any(String));
    expect(ids(container)).toEqual([id(2), id(9)]);
  });

  it('says so and keeps the form when a page cannot be loaded, and can try again', async () => {
    const loadPage = loader(
      { kind: 'failed' },
      { kind: 'page', page: { items: [candidate(5)], nextCursor: null } },
    );
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, 'Load more entries'));
    expect(text(container)).toContain(
      'More entries could not be loaded right now.',
    );
    await click(buttonNamed(container, 'Load more entries'));
    expect(ids(container)).toContain(id(5));
    expect(text(container)).not.toContain('could not be loaded right now');
  });

  it('links to sign-in when the session ended', async () => {
    const loadPage = loader({ kind: 'signin' });
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, 'Load more entries'));
    expect(text(container)).toContain('Your session ended');
    // The link returns to THIS page, like the save-401 link, not to the entry list.
    expect(
      container
        .querySelector('.cms-related-candidates a')
        ?.getAttribute('href'),
    ).toBe(`/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`);
  });

  it('shows Loading… and ignores a second click while a page is in flight', async () => {
    let release: ((value: CandidateFetch) => void) | undefined;
    const loadPage = vi.fn(
      () =>
        new Promise<CandidateFetch>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, 'Load more entries'));
    expect(buttonNamed(container, 'Loading…').disabled).toBe(true);
    await click(buttonNamed(container, 'Loading…'));
    expect(loadPage).toHaveBeenCalledTimes(1);
    release?.({ kind: 'failed' });
  });
});

describe('facts of a chosen entry', () => {
  it('survive a restart even when the entry came from a later page', async () => {
    const loadPage = loader(
      {
        kind: 'page',
        page: { items: [candidate(7, { locale: 'fr-FR' })], nextCursor: 'c2' },
      },
      { kind: 'restart' },
    );
    const { container } = mount({
      candidates: first,
      loadPage: loadPage as never,
    });
    await click(buttonNamed(container, 'Load more entries'));
    await click(buttonNamed(container, `Pin ${name(7)}`));
    await click(buttonNamed(container, 'Load more entries'));
    expect(ids(container)).toEqual([]);
    expect(
      container.querySelector('ol.cms-related-rows li small')?.textContent,
    ).toContain('fr-FR');
  });
});

describe('a candidate page that never answers (DEC-246 ruling 1)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('[P2-S12-AC-271] loading and error closing words: Load more entries leaves its loading state at the 8,000 ms deadline, says the page could not be loaded and offers it again, keeping the list', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = mount({ candidates: first });
    await click(buttonNamed(container, 'Load more entries'));
    expect(buttonNamed(container, 'Loading…').disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_999);
    });
    expect(buttonNamed(container, 'Loading…').disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(text(container)).toContain(
      'More entries could not be loaded right now.',
    );
    expect(buttonNamed(container, 'Load more entries').disabled).toBe(false);
    expect(ids(container)).toEqual([id(1), id(2)]);
  });
});
