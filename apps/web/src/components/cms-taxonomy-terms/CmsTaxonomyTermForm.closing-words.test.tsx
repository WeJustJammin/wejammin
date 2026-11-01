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
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import './term-action-preload.test-support';
import { formProps } from './term-form.test-support';

/**
 * The closing words of the FE03 state table for the vocabulary and term islands (CMS-03C-03, CMS-03C-16), P2-S12-AC-271:
 * "server-authoritative, no-store and never optimistic". Driven through the real transports (only `fetch` is faked): the
 * term action and the reads that follow it (the terms list and the versions) are same-origin `no-store` requests, and the
 * page claims no result before the action is answered.
 */
beforeAll(async () => {
  enableReactAct();
  await import('../cms-taxonomy-designer/taxonomy-versions-read');
  await import('./term-action-submit');
});
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const unavailable = () =>
  Response.json({ code: 'DEPENDENCY_UNAVAILABLE' }, { status: 503 });

describe('the term form: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: the action and the reads around it are same-origin no-store requests, and nothing is claimed before the action is answered', async () => {
    let fail: (error: Error) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
      init?.method === 'POST'
        ? new Promise<Response>((_resolve, reject) => {
            fail = reject;
          })
        : Promise.resolve(unavailable()),
    );
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountElement(
      <CmsTaxonomyTermForm {...formProps()} />,
    );
    await click(buttonNamed(container, 'Create a term'));
    await flush();
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    // In flight: no result heading, only the pending sentence, and the only request so far is the action itself.
    expect(container.querySelector('.cms-term-status h3')).toBeNull();
    expect(container.querySelector('.cms-term-status')?.textContent).toBe(
      'Saving the term…',
    );
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
    ]);
    // A lost answer is unknown: the lists are read again, and still no-store.
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
