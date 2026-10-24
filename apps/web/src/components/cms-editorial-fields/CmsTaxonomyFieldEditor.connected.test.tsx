// @vitest-environment jsdom

/**
 * The CONNECTED CMS-03C-17 taxonomy field selector as CMS-03B-01/10/11 value authoring
 * consumes it: CmsFieldEditor with the planned optional taxonomyContext prop
 * (`{ typeKey, locale, fetcher?, refreshToken? }`) (FE03 "Slice 12 governed definition,
 * composition, taxonomy, locale and related-content surfaces", P2-S12-AC-135; BE03c
 * CMS-03C-17).
 *
 * The tests drive the real editor through its public DOM and fake only fetch, through the
 * injected context, so they pin the allowlisted query (the entry type key, the decoded
 * descriptor's field key, the entry locale), the contract's default page size, the fixed
 * copy of every read state, the page-size-bounded pager and the host-owned value.
 *
 * RED today: CmsFieldEditor has no taxonomy dispatch, so it reads nothing and renders no
 * term control. Nothing here imports a module that does not exist.
 */

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
  byLabel,
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from './cms-editor-dom.test-support';
import {
  CONNECTED_COPY,
  ENTRY_LOCALE,
  ENTRY_TYPE_KEY,
  LOADING_PATTERN,
  LOAD_NEXT_LABEL,
  SELECTOR_PATH,
  START_AGAIN_LABEL,
  TAXONOMY_FIELD_KEY,
  TRY_AGAIN_LABEL,
  announcedCount,
  decodedTaxonomyField,
  deferred,
  failureResponse,
  hasButton,
  labelTexts,
  mountConnectedTaxonomy,
  noticeContains,
  noticeMatches,
  readPath,
  readQuery,
  readQueryKeys,
  recordingFetcher,
  servedPage,
  settle,
  signInHref,
  termCheckboxes,
  termUid,
  writeKeys,
} from './cms-taxonomy-connected-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

interface ContextOverrides {
  readonly typeKey?: string;
  readonly locale?: string;
  readonly refreshToken?: number;
}

const entryContext = (fetcher: typeof fetch, over: ContextOverrides = {}) => ({
  typeKey: over.typeKey ?? ENTRY_TYPE_KEY,
  locale: over.locale ?? ENTRY_LOCALE,
  fetcher,
  ...(over.refreshToken === undefined
    ? {}
    : { refreshToken: over.refreshToken }),
});

const REFUSALS: readonly [number, string][] = [
  [401, CONNECTED_COPY.signedOut],
  [403, CONNECTED_COPY.forbidden],
  [404, CONNECTED_COPY.notFound],
];

describe('the connected taxonomy selector: the protected read', () => {
  it('[P2-S12-AC-135] reads the allowlisted selector with the decoded field key, the entry type key, the locale and the default page size, and offers one checkbox per term', async () => {
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Post-rock' },
          { n: 2, label: 'Krautrock' },
        ],
      }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(fd.calls).toHaveLength(1);
    expect(readPath(fd.calls, 0)).toBe(SELECTOR_PATH);
    expect(readQuery(fd.calls, 0).get('typeKey')).toBe(ENTRY_TYPE_KEY);
    expect(readQuery(fd.calls, 0).get('fieldKey')).toBe(TAXONOMY_FIELD_KEY);
    expect(readQuery(fd.calls, 0).get('locale')).toBe(ENTRY_LOCALE);
    expect(
      readQueryKeys(fd.calls, 0)
        .filter((key) => key !== 'limit')
        .sort(),
    ).toEqual(['fieldKey', 'locale', 'typeKey']);
    expect(readQuery(fd.calls, 0).get('limit') ?? '50').toBe('50');
    expect(readQuery(fd.calls, 0).has('cursor')).toBe(false);
    expect(fd.calls[0]).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(fd.calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    expect(
      byLabel<HTMLInputElement>(mounted.container, 'Post-rock').value,
    ).toBe(termUid(1));
    expect(
      byLabel<HTMLInputElement>(mounted.container, 'Krautrock').value,
    ).toBe(termUid(2));
  });

  it('[P2-S12-AC-135] takes the field key from the decoded descriptor, never from the context, and keeps the field label', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1, label: 'Guitar' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({
      descriptor: decodedTaxonomyField({
        key: 'instruments',
        label: 'Instruments',
      }),
      context: entryContext(fd.fetcher, {
        typeKey: 'release_note',
        locale: 'fr-FR',
      }),
    });
    await settle();
    expect(readQuery(fd.calls, 0).get('typeKey')).toBe('release_note');
    expect(readQuery(fd.calls, 0).get('fieldKey')).toBe('instruments');
    expect(readQuery(fd.calls, 0).get('locale')).toBe('fr-FR');
    expect(mounted.container.textContent).toContain('Instruments');
  });

  it('[P2-S12-AC-135] sends no read at all without a context, and keeps the typed unavailable notice', async () => {
    const globalFetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('a read was attempted without a context');
    });
    vi.stubGlobal('fetch', globalFetcher);
    const mounted = mountConnectedTaxonomy({ context: undefined });
    await settle();
    expect(globalFetcher).not.toHaveBeenCalled();
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(mounted.container.textContent).toContain(CONNECTED_COPY.noContext);
  });
});

describe('the connected taxonomy selector: the read states', () => {
  it('[P2-S12-AC-135] announces a polite loading state while the first page is in flight, keeps the field label and writes no value', async () => {
    const pending = deferred<Response>();
    const fd = recordingFetcher([pending.promise]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(noticeMatches(mounted.container, LOADING_PATTERN)).toBe(true);
    expect(
      mounted.container.querySelector('[role="status"][aria-live="polite"]'),
    ).not.toBeNull();
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(mounted.container.textContent).toContain('Topics');
    await settle(() =>
      pending.resolve(servedPage({ items: [{ n: 1, label: 'Post-rock' }] })),
    );
    expect(noticeMatches(mounted.container, LOADING_PATTERN)).toBe(false);
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-135] renders a page with no term as the truthful empty state, with no invented option and no retry', async () => {
    const fd = recordingFetcher([servedPage({ items: [] })]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(noticeContains(mounted.container, CONNECTED_COPY.empty)).toBe(true);
    expect(termCheckboxes(mounted.container)).toHaveLength(0);
    expect(hasButton(mounted.container, TRY_AGAIN_LABEL)).toBe(false);
    expect(hasButton(mounted.container, LOAD_NEXT_LABEL)).toBe(false);
    expect(mounted.container.textContent).toContain('Topics');
    expect(mounted.onValue).not.toHaveBeenCalled();
  });

  it.each(REFUSALS)(
    '[P2-S12-AC-135] shows one fixed refusal sentence for a %i taxonomy read, with no control invented',
    async (status, copy) => {
      const fd = recordingFetcher([failureResponse(status)]);
      const mounted = mountConnectedTaxonomy({
        context: entryContext(fd.fetcher),
      });
      await settle();
      expect(noticeContains(mounted.container, copy)).toBe(true);
      expect(termCheckboxes(mounted.container)).toHaveLength(0);
      expect(mounted.container.textContent).toContain('Topics');
      expect(mounted.onValue).not.toHaveBeenCalled();
    },
  );

  it('[P2-S12-AC-135] offers a sign-in link that returns to this page on the 401 class', async () => {
    const fd = recordingFetcher([failureResponse(401)]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(signInHref(mounted.container)).toMatch(/^\/auth\/sign-in/u);
  });

  it('[P2-S12-AC-135] does not re-read a dependency refusal that declares no safe retry, and offers a retry that reloads the first page', async () => {
    const fd = recordingFetcher([
      failureResponse(503),
      servedPage({ items: [{ n: 1, label: 'Guitar' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(fd.calls).toHaveLength(1);
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(hasButton(mounted.container, TRY_AGAIN_LABEL)).toBe(true);
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).has('cursor')).toBe(false);
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
  });
});

describe('the connected taxonomy selector: the pager', () => {
  it('[P2-S12-AC-135] offers the next page only when the page has a cursor, and offers no restart on the first page', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1 }, { n: 2 }], nextCursor: 'cursor-one' }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    expect(hasButton(mounted.container, LOAD_NEXT_LABEL)).toBe(true);
    expect(hasButton(mounted.container, START_AGAIN_LABEL)).toBe(false);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
  });

  it('[P2-S12-AC-135] replaces the displayed page instead of combining pages, and keeps the contract page size', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1 }, { n: 2 }], nextCursor: 'cursor-one' }),
      servedPage({
        items: [{ n: 3 }, { n: 4 }, { n: 5 }],
        nextCursor: null,
        pageVersion: '8',
      }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('cursor')).toBe('cursor-one');
    expect(readQuery(fd.calls, 1).get('limit') ?? '50').toBe('50');
    expect(labelTexts(mounted.container)).toEqual([
      'Term 3',
      'Term 4',
      'Term 5',
    ]);
    expect(hasButton(mounted.container, START_AGAIN_LABEL)).toBe(true);
    expect(hasButton(mounted.container, LOAD_NEXT_LABEL)).toBe(false);
  });

  it('[P2-S12-AC-135] starts again from the first page without a cursor', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1 }, { n: 2 }], nextCursor: 'cursor-one' }),
      servedPage({
        items: [{ n: 3 }, { n: 4 }],
        nextCursor: null,
        pageVersion: '8',
      }),
      servedPage({
        items: [{ n: 1 }, { n: 2 }],
        nextCursor: 'cursor-one',
        pageVersion: '9',
      }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    await click(buttonNamed(mounted.container, START_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(3);
    expect(readQuery(fd.calls, 2).has('cursor')).toBe(false);
    expect(labelTexts(mounted.container)).toEqual(['Term 1', 'Term 2']);
  });
});

describe('the connected taxonomy selector: the host value', () => {
  it('[P2-S12-AC-135] writes exactly { termIds } when a term is toggled and claims no persisted state', async () => {
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
      }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
    });
    await settle();
    await click(byLabel<HTMLInputElement>(mounted.container, 'Alpha'));
    expect(mounted.emitted()).toEqual({ termIds: [termUid(1)] });
    expect(writeKeys(mounted.emitted())).toEqual(['termIds']);
    expect(mounted.container.textContent ?? '').not.toMatch(/\bsaved\b/iu);
  });

  it('[P2-S12-AC-135] never writes while a page loads, fails or comes back empty, and keeps the off-page selection with its announced count', async () => {
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
        nextCursor: 'cursor-one',
      }),
      failureResponse(503),
      servedPage({ items: [{ n: 3, label: 'Gamma' }] }),
    ]);
    const mounted = mountConnectedTaxonomy({
      context: entryContext(fd.fetcher),
      value: { termIds: [termUid(2)] },
    });
    await settle();
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(noticeContains(mounted.container, CONNECTED_COPY.degraded)).toBe(
      true,
    );
    expect(labelTexts(mounted.container)).toEqual(['Alpha', 'Beta']);
    expect(mounted.onValue).not.toHaveBeenCalled();
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await settle();
    expect(readQuery(fd.calls, 2).get('cursor')).toBe('cursor-one');
    expect(mounted.onValue).not.toHaveBeenCalled();
    expect(labelTexts(mounted.container)).toEqual(['Gamma']);
    expect(announcedCount(mounted.container)).toMatch(/\b1 terms? selected\b/u);
    await click(byLabel<HTMLInputElement>(mounted.container, 'Gamma'));
    expect(mounted.emittedIds()).toEqual([termUid(2), termUid(3)]);
    expect(writeKeys(mounted.emitted())).toEqual(['termIds']);
  });
});
