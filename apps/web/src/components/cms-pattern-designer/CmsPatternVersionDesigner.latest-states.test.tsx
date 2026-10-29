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

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { ReadNestable } from './use-nestable-patterns';

/*
 * [P2-S12-AC-271] `latestReadState` of `cmsPatternLatestRead` (FE03 "Slice 12 definition governance states"): the pattern
 * designer over its real conflict panel, hooks and latest reader (only `fetch` is replaced). The page is server HTML;
 * the read is the explicit "Check latest version" offered after a conflict.
 */
const wire = (overrides: Record<string, unknown> = {}): Response => {
  const detail = { ...latestDetail(), ...overrides };
  return Response.json(detail, {
    status: 200,
    headers: { etag: `"${String(detail.version)}"` },
  });
};
const newer = (): Response =>
  wire({
    version: '5',
    patternVersion: 5,
    nodeCount: 1,
    blockTree: [
      {
        kind: 'block',
        key: 'other',
        blockKey: 'profile.text',
        blockVersion: 3,
        props: {},
        children: [],
      },
    ],
  });
const refusal = (status: number): Response =>
  Response.json({ code: 'X', message: 'owner other-owner-key' }, { status });

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
const nodeKey = (container: HTMLElement): string =>
  byLabel<HTMLInputElement>(container, 'Node 1 key').value;
const press = async (container: HTMLElement): Promise<void> => {
  await click(check(container));
  await settle();
};
/** The nested-pattern picker's own read is outside this read; it answers an empty page. */
const readNestable = vi.fn<ReadNestable>(async () => ({
  kind: 'page',
  page: { items: [], nextCursor: null, pageVersion: '1' },
}));
const mount = (csrfToken = CSRF_TOKEN, context = designerContext) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={context}
      latest={latestDetail()}
      csrfToken={csrfToken}
      submit={submitStub({ kind: 'conflict', currentVersion: '5' })}
      readNestable={readNestable}
    />,
  );
/** Mounts the edit form, edits the first node key and saves: the conflict offers the check. */
const mountConflicted = async (
  ...reads: Array<Response | Promise<Response>>
) => {
  const fetcher = vi.fn<typeof fetch>();
  for (const read of reads)
    fetcher.mockImplementationOnce(() => Promise.resolve(read));
  vi.stubGlobal('fetch', fetcher);
  const view = mount();
  await typeInto(
    byLabel<HTMLInputElement>(view.container, 'Node 1 key'),
    'edited',
  );
  await click(save(view.container));
  await settle();
  return { ...view, fetcher };
};

describe('CmsPatternVersionDesigner (cmsPatternLatestRead) latestReadState', () => {
  it('[P2-S12-AC-271] latestReadState idle: cmsPatternLatestRead (CmsPatternVersionDesigner): server HTML rendered the latest version, no client read ran and the form is prefilled from it', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const { container } = mount();
    await settle(5_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Edit profile-hero');
    expect(container.textContent).toContain('Editing from version 2.');
    expect(byLabel<HTMLInputElement>(container, 'Pattern key').value).toBe(
      'profile-hero',
    );
    expect(nodeKey(container)).toBe('hero');
    expect(container.querySelector('.cms-pattern-conflict')).toBeNull();
    expect(skeleton(container)).toBeNull();
    expect(save(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] latestReadState loading (kept half): cmsPatternLatestRead (CmsPatternVersionDesigner): a skeleton after 250 ms (nothing at 249), the check control disabled, the read no-store; the submit control stays enabled (DEFECT)', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { container, fetcher } = await mountConflicted(held);
    await click(check(container));
    await settle(249);
    expect(skeleton(container)).toBeNull();
    expect(check(container).textContent).toBe('Checking latest version…');
    expect(check(container).disabled).toBe(true);
    await settle(1);
    expect(skeleton(container)?.getAttribute('role')).toBe('status');
    expect(skeleton(container)?.textContent).toBe(
      'Checking the latest version…',
    );
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/cms/patterns/profile-hero');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    await act(async () => {
      release(newer());
    });
    await settle();
    expect(skeleton(container)).toBeNull();
  });

  it('[P2-S12-AC-271] latestReadState success: cmsPatternLatestRead (CmsPatternVersionDesigner): a 200 detail is compared with the unsent tree, and Discard prefills the form from the latest read while Keep rebases only on request', async () => {
    const { container } = await mountConflicted(newer(), newer());
    await press(container);
    expect(container.textContent).toContain(
      'Latest saved version: 5, 1 node, draft.',
    );
    expect(nodeKey(container)).toBe('edited');
    await click(
      buttonNamed(container, /^Keep my edits and base them on version 5/u),
    );
    expect(container.textContent).toContain('Editing from version 5.');
    expect(nodeKey(container)).toBe('edited');
    expect(container.querySelector('.cms-pattern-conflict')).toBeNull();
    const second = await mountConflicted(newer());
    await press(second.container);
    await click(
      buttonNamed(second.container, /^Discard my edits and load version 5/u),
    );
    expect(second.container.textContent).toContain('Editing from version 5.');
    expect(nodeKey(second.container)).toBe('other');
  });

  it("[P2-S12-AC-271] latestReadState empty (not-disclosed): cmsPatternLatestRead (CmsPatternVersionDesigner): an absent or another owner's key answers 404 and shows only the concealing copy; no-records is N/A for a single-detail read", async () => {
    const { container } = await mountConflicted(refusal(404));
    await press(container);
    expect(alerts(container)).toContain(
      'This pattern is unavailable to the current acting context.',
    );
    expect(container.textContent).not.toContain('other-owner-key');
    expect(container.textContent).not.toContain('Latest saved version');
    expect(nodeKey(container)).toBe('edited');
  });

  it.each([
    [401, 'Your session expired. Sign in again.'],
    [403, 'Template designer access is required for this acting context.'],
    [404, 'This pattern is unavailable to the current acting context.'],
    [500, 'The latest version is unavailable. Wait and try again.'],
  ])(
    '[P2-S12-AC-271] latestReadState error: cmsPatternLatestRead (CmsPatternVersionDesigner): a typed %i read renders its fixed alert copy and keeps the unsent tree',
    async (status, copy) => {
      const { container } = await mountConflicted(refusal(status));
      await press(container);
      expect(alerts(container)).toContain(copy);
      expect(container.textContent).not.toContain('other-owner-key');
      expect(nodeKey(container)).toBe('edited');
      expect(check(container).disabled).toBe(false);
    },
  );

  it('[P2-S12-AC-271] latestReadState error: cmsPatternLatestRead (CmsPatternVersionDesigner): a 429 with Retry-After is announced politely (not an alert) and keeps the check off for the stated wait', async () => {
    const limited = Response.json(
      { code: 'RATE_LIMITED', message: 'm', details: { retryAfterSeconds: 5 } },
      { status: 429, headers: { 'retry-after': '5' } },
    );
    const { container } = await mountConflicted(limited);
    await press(container);
    const notice = container.querySelector('[data-cms-pattern-rate-limit]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toBe(rateLimitMessage(5));
    expect(alerts(container).join(' ')).not.toContain('rate');
    expect(check(container).disabled).toBe(true);
    expect(nodeKey(container)).toBe('edited');
  });

  it('[P2-S12-AC-271] latestReadState degraded (kept half): cmsPatternLatestRead (CmsPatternVersionDesigner): a read that fails keeps the base version and the unsent tree; the earlier verified latest comparison is dropped and submit is not held off (DEFECT)', async () => {
    const { container } = await mountConflicted(newer(), refusal(503));
    await press(container);
    expect(container.textContent).toContain('Latest saved version: 5');
    await press(container);
    expect(alerts(container)).toContain(
      'The latest version is unavailable. Wait and try again.',
    );
    expect(container.textContent).toContain('Editing from version 2.');
    expect(nodeKey(container)).toBe('edited');
  });

  it('[P2-S12-AC-271] latestReadState disabled: cmsPatternLatestRead (CmsPatternVersionDesigner): the reason names the missing session, the empty content-type prerequisite or the missing designer capability', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    const noSession = mount('');
    expect(noSession.container.textContent).toContain(
      'Reload to restore the protected form session.',
    );
    expect(save(noSession.container).disabled).toBe(true);
    const noTypes = mount(CSRF_TOKEN, {
      contentTypes: [],
      registeredBlocks: [],
    });
    expect(noTypes.container.textContent).toContain(
      'No active content types are available to this designer.',
    );
    expect(save(noTypes.container).disabled).toBe(true);
    const denied = await mountConflicted(refusal(403));
    await press(denied.container);
    expect(alerts(denied.container)).toContain(
      'Template designer access is required for this acting context.',
    );
  });
});
