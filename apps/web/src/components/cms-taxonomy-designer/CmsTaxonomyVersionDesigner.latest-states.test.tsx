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
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { summaryOf } from './CmsTaxonomyVersionList';
import {
  CSRF_TOKEN,
  fixtureVersions,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';

/*
 * [P2-S12-AC-271] `latestReadState` of `cmsTaxonomyVersionsRead` (FE03 "Slice 12 definition governance states"): the
 * vocabulary designer over its real conflict panel, hooks, version list and versions reader (only `fetch` is replaced).
 * The page and the version table are server HTML; a 409 is refetched by itself (FE03 1048, DEC-242 item 3): the first
 * scripted read is the automatic one and the explicit "Check latest version" only repeats a read.
 */
const base = versionFacts({
  version: '2',
  taxonomyVersion: 2,
  state: 'active',
});
const page = (items: unknown[] = [newerVersion()]): Response =>
  Response.json(
    { items, pageVersion: '4' },
    { status: 200, headers: { etag: '"4"' } },
  );
const newerVersion = (): Record<string, unknown> => ({
  ...fixtureVersions()[0],
  id: '40000000-0000-4000-8000-000000000044',
  version: '4',
  taxonomyVersion: 4,
  state: 'draft',
  shape: 'flat',
  allowedTypeKeys: ['article', 'release'],
  canonicalOverlapDomains: [],
  createdAt: '2026-10-14T12:00:00Z',
  updatedAt: '2026-10-14T12:00:00Z',
});
const refusal = (status: number): Response =>
  Response.json({ code: 'X', message: 'owner other-owner-key' }, { status });

beforeAll(enableReactAct);
// The versions read is an on-demand chunk (taxonomy-versions-on-demand.ts): a real module load
// cannot progress under the fake timers below, so load it before the first test needs it.
beforeAll(async () => {
  await import('./taxonomy-versions-read');
});
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
const check = (container: HTMLElement): HTMLButtonElement =>
  buttonNamed(container, /^Check(ing)? latest version/u);
const save = (container: HTMLElement): HTMLButtonElement =>
  buttonNamed(container, /^(Save successor draft|Saving…)$/u);
const skeleton = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-loading-region');
const alerts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[role="alert"]')).map(
    (entry) => entry.textContent ?? '',
  );
const flat = (container: HTMLElement): HTMLInputElement =>
  byLabel<HTMLInputElement>(container, /^Flat/u);
const place = (container: HTMLElement): HTMLInputElement =>
  byLabel<HTMLInputElement>(container, 'Place');
const press = async (container: HTMLElement): Promise<void> => {
  await click(check(container));
  await settle();
};
const mount = (csrfToken = CSRF_TOKEN) =>
  mountElement(
    <CmsTaxonomyVersionDesigner
      latest={base}
      versions={fixtureVersions().map(summaryOf)}
      csrfToken={csrfToken}
      submit={submitStub({ kind: 'conflict', currentVersion: '4' })}
    />,
  );
/** Mounts the edit form, toggles a domain and saves: the 409 starts the first scripted read by itself. */
const mountConflicted = async (
  ...reads: Array<Response | Promise<Response>>
) => {
  const fetcher = vi.fn<typeof fetch>();
  for (const read of reads)
    fetcher.mockImplementationOnce(() => Promise.resolve(read));
  vi.stubGlobal('fetch', fetcher);
  const view = mount();
  await click(place(view.container));
  await click(save(view.container));
  await settle();
  return { ...view, fetcher };
};

describe('CmsTaxonomyVersionDesigner (cmsTaxonomyVersionsRead) latestReadState', () => {
  it('[P2-S12-AC-271] latestReadState idle: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): server HTML rendered the version table and the latest version, no client read ran and the form is prefilled from it', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const { container } = mount();
    await settle(5_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.querySelector('caption')?.textContent).toBe(
      'Versions of this vocabulary, newest first (3)',
    );
    expect(container.textContent).toContain('Editing from version 2.');
    expect(byLabel<HTMLInputElement>(container, 'Vocabulary key').value).toBe(
      'instruments',
    );
    expect(byLabel<HTMLInputElement>(container, /^Hierarchical/u).checked).toBe(
      true,
    );
    expect(container.querySelector('.cms-taxonomy-conflict')).toBeNull();
    expect(skeleton(container)).toBeNull();
    expect(save(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): a skeleton after 250 ms (nothing at 249), the check control disabled, the read no-store, and the submit control disabled until the read answers', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { container, fetcher } = await mountConflicted(held);
    await settle(249);
    expect(skeleton(container)).toBeNull();
    expect(check(container).textContent).toBe('Checking latest version…');
    expect(check(container).disabled).toBe(true);
    await settle(1);
    expect(skeleton(container)?.getAttribute('role')).toBe('status');
    expect(skeleton(container)?.textContent).toBe(
      'Checking the latest version…',
    );
    expect(save(container).disabled).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(
      /^\/api\/v1\/cms\/taxonomies\/[0-9a-f-]{36}\/versions$/u,
    );
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    await act(async () => {
      release(page());
    });
    await settle();
    expect(skeleton(container)).toBeNull();
  });

  it('[P2-S12-AC-271] latestReadState success: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): a 200 page is compared with the unsent draft, and Discard prefills the form from the latest read while Keep rebases only on request', async () => {
    const { container, fetcher } = await mountConflicted(page());
    // No press: the 409 itself read the versions.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Latest saved version: 4, draft.');
    expect(container.textContent).toContain('Version 4: Flat');
    expect(place(container).checked).toBe(true);
    expect(flat(container).checked).toBe(false);
    await click(
      buttonNamed(container, 'Keep my edits and base them on version 4'),
    );
    expect(container.textContent).toContain('Editing from version 4.');
    expect(place(container).checked).toBe(true);
    expect(container.querySelector('.cms-taxonomy-conflict')).toBeNull();
    const second = await mountConflicted(page());
    await click(
      buttonNamed(second.container, 'Discard my edits and load version 4'),
    );
    expect(second.container.textContent).toContain('Editing from version 4.');
    expect(flat(second.container).checked).toBe(true);
    expect(place(second.container).checked).toBe(false);
  });

  it("[P2-S12-AC-271] latestReadState empty (not-disclosed): cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): an absent or another owner's vocabulary answers 404 and shows only the concealing copy; no-records is N/A (an existing vocabulary always has a version; a zero-item page is refused as unverifiable)", async () => {
    const { container } = await mountConflicted(refusal(404));
    expect(alerts(container)).toContain(
      'This vocabulary is unavailable to the current acting context.',
    );
    expect(container.textContent).not.toContain('other-owner-key');
    expect(container.textContent).not.toContain('Latest saved version');
    const empty = await mountConflicted(page([]));
    expect(alerts(empty.container)).toContain(
      'The latest version could not be verified. Reload.',
    );
  });

  it.each([
    [401, 'Your session expired. Sign in again.'],
    [403, 'Taxonomy curator access is required for this acting context.'],
    [404, 'This vocabulary is unavailable to the current acting context.'],
    [
      429,
      'The latest version could not be read because of rate limiting. Wait and try again.',
    ],
    [500, 'The latest version is unavailable. Wait and try again.'],
  ])(
    '[P2-S12-AC-271] latestReadState error: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): a typed %i read renders its fixed alert copy and keeps the unsent draft',
    async (status, copy) => {
      const { container } = await mountConflicted(refusal(status));
      expect(alerts(container)).toContain(copy);
      expect(container.textContent).not.toContain('other-owner-key');
      expect(place(container).checked).toBe(true);
      expect(check(container).disabled).toBe(false);
    },
  );

  it('[P2-S12-AC-271] latestReadState degraded: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): a read that fails keeps the base version, the unsent draft and the earlier verified comparison, and submit stays disabled', async () => {
    const { container } = await mountConflicted(page(), refusal(503));
    expect(container.textContent).toContain('Latest saved version: 4');
    await press(container);
    expect(alerts(container)).toContain(
      'The latest version is unavailable. Wait and try again.',
    );
    expect(container.textContent).toContain('Editing from version 2.');
    expect(container.textContent).toContain('Latest saved version: 4');
    expect(place(container).checked).toBe(true);
    expect(container.querySelector('caption')?.textContent).toContain('(3)');
    expect(save(container).disabled).toBe(true);
  });

  it('[P2-S12-AC-271] latestReadState loading: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): the kept comparison cannot be adopted while a re-read runs, and can be once the read failed or answered', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { container } = await mountConflicted(page(), held);
    const keep = () =>
      buttonNamed(container, 'Keep my edits and base them on version 4');
    const discard = () =>
      buttonNamed(container, 'Discard my edits and load version 4');
    expect([keep().disabled, discard().disabled]).toEqual([false, false]);
    await click(check(container));
    expect([keep().disabled, discard().disabled]).toEqual([true, true]);
    await act(async () => {
      release(refusal(503));
    });
    await settle();
    expect([keep().disabled, discard().disabled]).toEqual([false, false]);
  });

  it('[P2-S12-AC-271] latestReadState disabled: cmsTaxonomyVersionsRead (CmsTaxonomyVersionDesigner): the reason names the missing session or the missing curator capability; the empty prerequisite is N/A (a new vocabulary has no version to read, so no check exists)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    const noSession = mount('');
    expect(noSession.container.textContent).toContain(
      'Reload to restore the protected form session.',
    );
    expect(save(noSession.container).disabled).toBe(true);
    const fresh = mountElement(
      <CmsTaxonomyVersionDesigner latest={null} csrfToken={CSRF_TOKEN} />,
    );
    expect(fresh.container.textContent).not.toContain('Check latest version');
    const denied = await mountConflicted(refusal(403));
    expect(alerts(denied.container)).toContain(
      'Taxonomy curator access is required for this acting context.',
    );
  });
});
