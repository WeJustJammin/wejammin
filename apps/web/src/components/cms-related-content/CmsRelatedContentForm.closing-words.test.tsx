// @vitest-environment jsdom
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
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY_ID,
  PAGE_PATH,
  candidate,
  id,
  listItems,
  mount,
  text,
} from './related-content.test-support';
import { json, resource } from './related-content-submit.test-support';

/*
 * [P2-S12-AC-271] the closing words of the Slice 12 state table (FE03 1042): "each [state] is server-authoritative and
 * `no-store`, and none is optimistic", for the related-content island's two requests with their real transport: the
 * candidate page read (CMS-03B entry list) and the save (CMS-03C-05). Each request is a `no-store`, same-origin fetch,
 * and while it is in flight the form shows what it showed before: no candidate appears, no version moves, and nothing is
 * called saved until the server answers. (The conflict review reads are pinned the same way in
 * `CmsRelatedContentForm.conflict.test.tsx`.)
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const held = () => {
  let answer: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => (answer = resolve));
  return { promise, answer };
};
const entryItem = (n: number) => ({
  id: `028f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`,
  revisionNumber: '2',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-15T10:00:00Z',
  authorClass: 'author',
  entryId: id(n),
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-15T11:00:00Z',
});
const candidateIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('table tbody th code')).map(
    (code) => code.textContent ?? '',
  );

describe('related content: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] loading and success closing words: Load more entries is a no-store, same-origin GET, and the list shows no new candidate before the page answers', async () => {
    const next = held();
    const fetcher = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return next.promise;
    });
    vi.stubGlobal('fetch', fetcher);
    const { container } = mount({
      candidates: {
        items: [candidate(1), candidate(2)],
        nextCursor: 'cursor-1',
      },
    });
    await click(buttonNamed(container, 'Load more entries'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(candidateIds(container)).toEqual([id(1), id(2)]);
    next.answer(
      json(200, {
        items: [entryItem(3)],
        nextCursor: null,
        pageVersion: '7',
      }),
    );
    await flush();
    expect(candidateIds(container)).toEqual([id(1), id(2), id(3)]);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/cms/entries?');
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('[P2-S12-AC-271] commandState closing words: Save related content is a no-store, same-origin POST, and nothing is called saved, no version moves and no pin changes before the server answers', async () => {
    const saving = held();
    const fetcher = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return saving.promise;
    });
    vi.stubGlobal('fetch', fetcher);
    const { container } = mount();
    await click(buttonNamed(container, `Pin entry ${id(1).slice(-12)}`));
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(text(container)).toContain('Saving related content…');
    expect(text(container)).not.toContain('Related content saved');
    expect(text(container)).toContain('Entry version4');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    saving.answer(
      json(
        201,
        resource({
          sourceEntryId: ENTRY_ID,
          pins: [id(1)],
          exclusions: [],
          derivedRule: null,
          eligibleCount: 0,
        }),
        { etag: '"5"' },
      ),
    );
    await flush();
    expect(text(container)).toContain('Related content saved');
    expect(text(container)).toContain('Entry version5');
    expect(PAGE_PATH).toContain(ENTRY_ID);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v1/cms/entries/${ENTRY_ID}/related-content`);
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });
});
