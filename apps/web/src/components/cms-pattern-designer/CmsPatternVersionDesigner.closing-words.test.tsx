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
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
} from './pattern-designer.test-support';

/**
 * The closing words of the FE03 state table for the pattern version designer (CMS-03C-12), P2-S12-AC-271:
 * "server-authoritative, no-store and never optimistic". Driven through the real transports (only `fetch` is faked): the
 * save, the read of the latest version after an unknown outcome and the nestable-pattern read are same-origin
 * `no-store` requests, and the page claims nothing and rewrites no address before the save is answered.
 */
beforeAll(async () => {
  enableReactAct();
  // The latest-version read is an on-demand chunk (pattern-latest-read.ts): load it up front.
  await import('./pattern-latest-fetch');
});
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
const unavailable = () =>
  Response.json({ code: 'DEPENDENCY_UNAVAILABLE' }, { status: 503 });

describe('the pattern version designer: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: the save and the reads around it are same-origin no-store requests, and nothing is claimed before the save is answered', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/cms-content-modeling/patterns/profile-hero',
    );
    let answer: (response: Response) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(unavailable()),
    );
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
      />,
    );
    await flush();
    const treeBefore = container.querySelector('#cms-pattern-tree')?.innerHTML;
    await click(commit(container));
    await flush();
    const status = container.querySelector('#cms-pattern-status')!;
    // In flight: the pending sentence, the unchanged tree and the page's own address.
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('Saving the pattern draft…');
    expect(status.textContent).not.toMatch(/saved|created/iu);
    expect(container.querySelector('#cms-pattern-tree')?.innerHTML).toBe(
      treeBefore,
    );
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/profile-hero',
    );
    expect(
      fetcher.mock.calls.filter(([, i]) => i?.method === 'POST'),
    ).toHaveLength(1);
    // A response whose outcome is unknown: the island reads the latest version itself, still no-store.
    await act(async () => {
      answer(
        new Response(null, {
          status: 502,
          headers: { 'x-cms-editorial-outcome': 'unknown' },
        }),
      );
    });
    await flush();
    const requests = fetcher.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      cache: init?.cache,
      credentials: init?.credentials,
    }));
    expect(requests.some((r) => r.method === 'POST')).toBe(true);
    expect(
      requests.some((r) => r.url === '/api/v1/cms/patterns/profile-hero'),
    ).toBe(true);
    for (const request of requests) {
      expect(request.cache).toBe('no-store');
      expect(request.credentials).toBe('same-origin');
    }
  });
});
