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
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { CSRF_TOKEN, versionFacts } from './taxonomy-designer.test-support';

/**
 * The closing words of the FE03 state table for the vocabulary designer (CMS-03C-16), P2-S12-AC-271: "server-authoritative,
 * no-store and never optimistic". Driven through the real transports (only `fetch` is faked): the save and the read of the
 * versions after an unknown outcome are same-origin `no-store` requests, and the page claims no save before it is answered.
 */
beforeAll(async () => {
  enableReactAct();
  await import('./taxonomy-versions-read');
  await import('./taxonomy-designer-submit');
  await import('./taxonomy-outcome-reconcile');
});
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const unavailable = () =>
  Response.json({ code: 'DEPENDENCY_UNAVAILABLE' }, { status: 503 });

describe('the vocabulary designer: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: the save and the read after it are same-origin no-store requests, and nothing is claimed before the save is answered', async () => {
    let fail: (error: Error) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
      init?.method === 'POST'
        ? new Promise<Response>((_resolve, reject) => {
            fail = reject;
          })
        : Promise.resolve(unavailable()),
    );
    vi.stubGlobal('fetch', fetcher);
    const base = versionFacts();
    const { container } = mountElement(
      <CmsTaxonomyVersionDesigner latest={base} csrfToken={CSRF_TOKEN} />,
    );
    await click(byLabel(container, 'Place'));
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(container.textContent).not.toContain('Vocabulary draft saved');
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
    ]);
    await act(async () => {
      fail(new Error('response lost after send'));
    });
    await flush();
    const requests = fetcher.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      cache: init?.cache,
      credentials: init?.credentials,
    }));
    expect(requests.some((request) => request.method === 'GET')).toBe(true);
    for (const request of requests) {
      expect(request.cache).toBe('no-store');
      expect(request.credentials).toBe('same-origin');
    }
  });
});
