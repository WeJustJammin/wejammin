// @vitest-environment jsdom
import './term-action-preload.test-support';
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
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  selectBy,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm, {
  type CmsTaxonomyTermFormProps,
} from './CmsTaxonomyTermForm';
import {
  doneResult,
  formProps,
  heldTermsRead,
  namedTerm,
  optionValues,
  pageFacts,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termFacts,
  termsLoaded,
  termsPage,
} from './term-form.test-support';

/*
 * [P2-S12-AC-271] `latestReadState` of `cmsTaxonomyTermsRead` (FE03 "Slice 12 definition governance states"): the term
 * island CmsTaxonomyTermForm over its real list refresh, parent/survivor picker and reads (only the read seams are
 * replaced). The first page is server HTML; later reads are the refresh after an action and the picker's pages.
 */
const CELLO = namedTerm(
  '50000000-0000-4000-8000-0000000000c1',
  'cello',
  'Cello',
);
const TUBA = namedTerm('50000000-0000-4000-8000-0000000000a1', 'tuba', 'Tuba');

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const text = (container: HTMLElement): string => container.textContent ?? '';
const skeleton = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-loading-region');
const alerts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[role="alert"]')).map(
    (entry) => entry.textContent ?? '',
  );
const rows = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('tbody th')).map(
    (entry) => entry.textContent ?? '',
  );
const mount = (props: Partial<CmsTaxonomyTermFormProps> = {}) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({ readVersions: readVersionsStub(), ...props })}
    />,
  );
/** Creates a term: the done result makes the island refetch the list and the versions. */
const createTerm = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Create a term'));
  await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
  await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
  await click(buttonNamed(container, 'Create term'));
  await settle();
};
const mountRefreshed = async (
  readTerms: CmsTaxonomyTermFormProps['readTerms'] | undefined,
) => {
  const view = mount({ submit: submitStub(doneResult()), readTerms });
  await createTerm(view.container);
  return view;
};
/** The real terms reader over a refused `fetch`: the body is another owner's text that must not render. */
const mountFetched = async (status: number) => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ code: 'X', message: 'owner other-owner-key' }, { status }),
  );
  vi.stubGlobal('fetch', fetcher);
  const view = await mountRefreshed(undefined);
  return { ...view, fetcher };
};
const partial = { terms: pageFacts(undefined, { nextCursor: 'page.2' }) };
const openMerge = (container: HTMLElement) =>
  click(buttonNamed(container, 'Merge term guitar into another'));

describe('CmsTaxonomyTermForm (cmsTaxonomyTermsRead) latestReadState', () => {
  it('[P2-S12-AC-271] latestReadState idle: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): server HTML rendered the first page of terms, no client read ran and no form is open', async () => {
    const readTerms = readTermsStub(termsLoaded());
    const readVersions = readVersionsStub();
    const { container } = mount({ readTerms, readVersions });
    await settle(5_000);
    expect(readTerms).not.toHaveBeenCalled();
    expect(readVersions).not.toHaveBeenCalled();
    expect(rows(container)).toEqual([
      'guitar',
      'organ',
      'strings',
      'old-organ',
    ]);
    expect(text(container)).toContain('4 terms on this page.');
    expect(container.querySelector('.cms-term-action')).toBeNull();
    expect(skeleton(container)).toBeNull();
    expect(buttonNamed(container, 'Create a term').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a picker page read shows a skeleton after 250 ms (nothing at 249) over a no-store GET with the commit control off', async () => {
    const held = heldTermsRead();
    const { container } = mount({ ...partial, readTerms: held.read });
    await openMerge(container);
    await settle(249);
    expect(held.pending()).toBe(1);
    expect(skeleton(container)).toBeNull();
    await settle(1);
    expect(skeleton(container)?.getAttribute('role')).toBe('status');
    expect(skeleton(container)?.textContent).toBe('Loading terms…');
    expect(buttonNamed(container, 'Review the merge').disabled).toBe(true);
    expect(held.read).toHaveBeenCalledWith(expect.any(String), { limit: 50 });
    await act(async () => held.release(termsPage([TUBA], null)));
    await settle();
    expect(skeleton(container)).toBeNull();
    expect(buttonNamed(container, 'Review the merge').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading (list refresh): cmsTaxonomyTermsRead (CmsTaxonomyTermForm): the refresh after an action shows a skeleton after 250 ms (nothing at 249) with the prior list kept and every term action off until it answers', async () => {
    const held = heldTermsRead();
    const { container } = mount({
      submit: submitStub(doneResult()),
      readTerms: held.read,
    });
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await settle(249);
    expect(held.pending()).toBe(1);
    expect(skeleton(container)).toBeNull();
    await settle(1);
    expect(skeleton(container)?.getAttribute('role')).toBe('status');
    expect(skeleton(container)?.textContent).toBe('Refreshing the terms…');
    expect(rows(container)).toEqual([
      'guitar',
      'organ',
      'strings',
      'old-organ',
    ]);
    expect(() => buttonNamed(container, 'Create a term')).toThrow();
    expect(() => buttonNamed(container, 'Rename term guitar')).toThrow();
    await act(async () =>
      held.release(termsLoaded(pageFacts([termFacts(), CELLO]))),
    );
    await settle();
    expect(skeleton(container)).toBeNull();
    expect(buttonNamed(container, 'Create a term').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading (list refresh): cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a form kept open by a conflict has its commit control off until the reconciling refresh answers', async () => {
    const held = heldTermsRead();
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: '3' }),
      readTerms: held.read,
    });
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await settle();
    expect(held.pending()).toBe(1);
    expect(buttonNamed(container, 'Create term').disabled).toBe(true);
    await act(async () =>
      held.release(termsLoaded(pageFacts([termFacts(), CELLO]))),
    );
    await settle();
    expect(buttonNamed(container, 'Create term').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState success: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a 200 page is shown in place of the list and a form opened afterwards prefills from it; a picker page adds its terms to the choices', async () => {
    const readTerms = readTermsStub(
      termsLoaded(pageFacts([termFacts(), CELLO])),
    );
    const { container } = await mountRefreshed(readTerms);
    expect(readTerms).toHaveBeenCalledTimes(1);
    expect(rows(container)).toEqual(['guitar', 'cello']);
    expect(text(container)).toContain('2 terms on this page.');
    await click(buttonNamed(container, 'Rename term cello'));
    expect(byLabel<HTMLInputElement>(container, 'Label 1').value).toBe('Cello');
    const picker = mount({
      ...partial,
      readTerms: readTermsStub(termsPage([TUBA], null)),
    });
    await openMerge(picker.container);
    await settle();
    const select = selectBy(picker.container, '#cms-term-survivor');
    expect(optionValues(select)).toContain(TUBA.termId);
  });

  it('[P2-S12-AC-271] latestReadState empty (no-records): cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a page with no terms says so and keeps the create control; not-disclosed shows only the concealing copy for a refused key', async () => {
    const empty = mount({ terms: pageFacts([]) });
    expect(text(empty.container)).toContain(
      'No terms match. A new vocabulary starts without terms.',
    );
    expect(text(empty.container)).toContain('0 terms on this page.');
    expect(empty.container.querySelector('table')).toBeNull();
    expect(buttonNamed(empty.container, 'Create a term').disabled).toBe(false);
    const concealed = await mountFetched(404);
    expect(alerts(concealed.container)[0]).toContain(
      'The list could not be refreshed',
    );
    expect(text(concealed.container)).not.toContain('other-owner-key');
  });

  it.each([401, 403, 404, 429, 500])(
    '[P2-S12-AC-271] latestReadState error: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a typed %i refresh keeps the last verified list and turns term actions off with one fixed alert',
    async (status) => {
      const { container, fetcher } = await mountFetched(status);
      const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(
        /^\/api\/v1\/cms\/taxonomies\/[0-9a-f-]{36}\/terms$/u,
      );
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
      expect(alerts(container).join(' ')).toContain(
        'The list could not be refreshed, so the last verified list is shown and term actions are off.',
      );
      expect(text(container)).not.toContain('other-owner-key');
      expect(rows(container)).toEqual([
        'guitar',
        'organ',
        'strings',
        'old-organ',
      ]);
      expect(container.querySelector('.cms-term-actions')).toBeNull();
    },
  );

  it('[P2-S12-AC-271] latestReadState error: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a 409 cursor conflict restarts from the first page and says so', async () => {
    const readTerms = readTermsStub(
      { kind: 'rejected', status: 409 },
      termsLoaded(pageFacts([termFacts(), CELLO])),
    );
    const { container } = await mountRefreshed(readTerms);
    expect(readTerms).toHaveBeenCalledTimes(2);
    expect(text(container)).toContain(
      'The list changed while you were paging, so it restarted from the first page.',
    );
    expect(rows(container)).toEqual(['guitar', 'cello']);
  });

  it('[P2-S12-AC-271] latestReadState degraded: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a refresh that fails keeps the last verified page, turns every term action and the open form off, and a later good read restores them', async () => {
    const readTerms = readTermsStub(
      { kind: 'unavailable' },
      termsLoaded(pageFacts([termFacts(), CELLO])),
    );
    const { container } = await mountRefreshed(readTerms);
    expect(rows(container)).toEqual([
      'guitar',
      'organ',
      'strings',
      'old-organ',
    ]);
    expect(container.querySelector('.cms-term-action')).toBeNull();
    expect(() => buttonNamed(container, 'Create a term')).toThrow();
    expect(() => buttonNamed(container, 'Rename term guitar')).toThrow();
    await click(buttonNamed(container, 'Refresh the list'));
    await settle();
    expect(rows(container)).toEqual(['guitar', 'cello']);
    expect(buttonNamed(container, 'Create a term').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState degraded: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a refresh that fails after an unknown outcome closes the open form, so nothing can be submitted until a read is verified', async () => {
    const view = mount({
      submit: submitStub({ kind: 'uncertain' }),
      readTerms: readTermsStub({ kind: 'unavailable' }),
    });
    await click(buttonNamed(view.container, 'Create a term'));
    await typeInto(
      byLabel<HTMLInputElement>(view.container, 'Term key'),
      'cello',
    );
    await typeInto(
      byLabel<HTMLInputElement>(view.container, 'Label 1'),
      'Cello',
    );
    await click(buttonNamed(view.container, 'Create term'));
    await settle();
    expect(alerts(view.container).join(' ')).toContain(
      'The list could not be refreshed',
    );
    expect(view.container.querySelector('.cms-term-action')).toBeNull();
    expect(() => buttonNamed(view.container, 'Create term')).toThrow();
  });

  it('[P2-S12-AC-271] latestReadState degraded: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): a picker page that fails keeps the pages already read and offers Try again', async () => {
    const readTerms = readTermsStub(
      termsPage([TUBA], 'page.3'),
      { kind: 'unavailable' },
      termsPage([CELLO], null),
    );
    const { container } = mount({ ...partial, readTerms });
    await openMerge(container);
    await settle();
    await click(buttonNamed(container, 'Load more terms'));
    await settle();
    expect(alerts(container)).toContain('More terms could not be loaded.');
    const select = selectBy(container, '#cms-term-survivor');
    expect(optionValues(select)).toContain(TUBA.termId);
    await click(buttonNamed(container, 'Try again'));
    await settle();
    expect(optionValues(select)).toContain(CELLO.termId);
  });

  it('[P2-S12-AC-271] latestReadState disabled: cmsTaxonomyTermsRead (CmsTaxonomyTermForm): with no active version the reason names it, term actions are absent and the terms are read-only', async () => {
    const none = mount({
      vocabulary: { ...formProps().vocabulary, active: null },
    });
    expect(text(none.container)).toContain(
      'This vocabulary has no active version, so its terms cannot change. They are listed read-only.',
    );
    expect(
      none.container.querySelector('a[href*="definition-reviews"]'),
    ).not.toBeNull();
    expect(() => buttonNamed(none.container, 'Create a term')).toThrow();
    expect(rows(none.container)).toHaveLength(4);
    const bounded = mount({
      vocabulary: {
        ...formProps().vocabulary,
        active: null,
        versionsBounded: true,
      },
    });
    expect(text(bounded.container)).toContain(
      'No active version was found among the newest 50 versions of this vocabulary.',
    );
  });
});
