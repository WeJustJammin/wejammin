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
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { mount, text } from './locale-variant-form.test-support';
import {
  CHAIN,
  ENTRY_ID,
  HASH,
  LEGAL,
  LOCALE,
  SOURCE_REVISION_ID,
  TITLE,
} from './locale-variant.test-support';

/**
 * The closing words of the FE03 state table for the locale variant form (CMS-03C-04), P2-S12-AC-271: "server-authoritative,
 * no-store and never optimistic". Driven through the real transports (only `fetch` is faked): the save and the draft
 * detail read after it are same-origin `no-store` requests, and the page claims nothing before the server answers.
 */
beforeAll(async () => {
  enableReactAct();
  // The save and the source read are on-demand chunks (locale-variant-submit-seam.ts): load them up front.
  await import('./locale-variant-submit');
  await import('./locale-source-refresh');
});
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const saved = () =>
  new Response(
    JSON.stringify({
      id: '018f0c45-73fe-7dc2-9c09-68f7ecf132e1',
      version: '1',
      contentHash: 'b'.repeat(64),
      createdAt: '2026-10-22T10:00:00.000Z',
      updatedAt: '2026-10-22T10:00:00.000Z',
      state: 'draft',
      entryId: ENTRY_ID,
      revisionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e0',
      locale: LOCALE,
      sourceRevisionId: SOURCE_REVISION_ID,
      fallbackChain: [...CHAIN],
      noFallbackFieldIds: [LEGAL],
      staleFieldIds: [],
    }),
    { status: 201, headers: { etag: '"5"' } },
  );
const draftDetail = () =>
  Response.json({
    entry: { id: ENTRY_ID, version: '5' },
    revision: { id: SOURCE_REVISION_ID },
    locale: 'en-US',
    contentHash: HASH,
    fields: [{ fieldId: TITLE, value: 'Spring tour' }],
  });

describe('the locale variant form: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: the save and the read after it are same-origin no-store requests, and nothing is claimed before the save is answered', async () => {
    let answer: (response: Response) => void = () => undefined;
    const reads: Array<Response | Promise<Response>> = [draftDetail()];
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(reads.shift() ?? Response.json({}, { status: 503 })),
    );
    vi.stubGlobal('fetch', fetcher);
    const view = mount();
    await typeInto(byLabel(view.container, 'Title'), 'Un titre');
    await click(buttonNamed(view.container, 'Save translation'));
    await flush();
    // In flight: the pending sentence, the typed value, and no claim of a save.
    expect(text(view.container)).toContain('Saving translation…');
    expect(text(view.container)).not.toContain('Translation saved as a draft');
    expect(byLabel<HTMLInputElement>(view.container, 'Title').value).toBe(
      'Un titre',
    );
    expect(
      fetcher.mock.calls.filter(([, i]) => i?.method === 'GET'),
    ).toHaveLength(0);
    await act(async () => {
      answer(saved());
    });
    await flush();
    expect(text(view.container)).toContain('Translation saved as a draft');
    const requests = fetcher.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      cache: init?.cache,
      credentials: init?.credentials,
    }));
    expect(requests.map((request) => request.method)).toEqual(['POST', 'GET']);
    for (const request of requests) {
      expect(request.cache).toBe('no-store');
      expect(request.credentials).toBe('same-origin');
    }
  });
});
