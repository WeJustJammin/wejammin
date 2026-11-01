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

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
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
import { formProps } from './term-form.test-support';

/**
 * DEC-246(1): the terms read (here the refresh that follows a lost term action) has the shared 8,000 ms deadline, and a
 * read that never answers ends in the island's own failed cell with the control that repeats it. The real readers run;
 * only `fetch` is faked, and it never answers a read.
 */
beforeAll(async () => {
  enableReactAct();
  await import('../cms-taxonomy-designer/taxonomy-versions-read');
  await import('./taxonomy-terms-fetch');
  await import('./term-action-submit');
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('the term form: a read that never answers', () => {
  it('[P2-S12-AC-271] commandState degraded: the refresh after a lost term action ends at the deadline in its failed cell, and Refresh the list asks again', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation((_url, init) =>
        init?.method === 'POST'
          ? Promise.reject(new Error('response lost after send'))
          : new Promise<Response>(() => undefined),
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
    const termReads = () =>
      fetcher.mock.calls.filter(([url]) => String(url).includes('/terms'));
    const first = termReads().length;
    expect(first).toBeGreaterThanOrEqual(1);
    await settle(BROWSER_READ_DEADLINE_MS - 1);
    expect(container.textContent).not.toContain(
      'The list could not be refreshed',
    );
    await settle(1);
    expect(container.textContent).toContain('The list could not be refreshed');
    expect(buttonNamed(container, 'Refresh the list').disabled).toBe(false);
    await click(buttonNamed(container, 'Refresh the list'));
    expect(termReads().length).toBeGreaterThan(first);
  });
});
