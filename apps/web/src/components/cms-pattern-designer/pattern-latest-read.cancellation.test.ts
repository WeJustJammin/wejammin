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
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  unmountEveryMountedRoot,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  unmountEveryMountedRoot();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const retryable = (): Response =>
  new Response(
    JSON.stringify({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe dependency message',
      requestId: '0195b6f0-0000-7000-8000-000000000001',
      details: { dependencyClass: 'cms_composition', retryable: true },
    }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );

const advance = async (milliseconds: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

/** The real default reader and its real 250/750 ms sleeps run against an intercepted fetch. */
describe('mounted pattern default-reader retry cancellation (FE03 :1175)', () => {
  it.each([250, 750])(
    'cancels the %i ms safe retry when the designer unmounts',
    async (delay) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => retryable());
      vi.stubGlobal('fetch', fetcher);
      const submit = submitStub({ kind: 'uncertain' });
      // Omit readLatest: this mounts usePatternConflict -> readLatestPatternVersion -> retryingSafeRead.
      const view = mountElement(
        React.createElement(CmsPatternVersionDesigner, {
          context: designerContext,
          latest: latestDetail(),
          csrfToken: CSRF_TOKEN,
          submit,
        }),
      );
      await click(buttonNamed(view.container, 'Save successor draft'));
      await advance(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      if (delay === 750) {
        await advance(1);
        expect(fetcher).toHaveBeenCalledTimes(2);
        await advance(749);
      }
      const readsBeforeUnmount = delay === 250 ? 1 : 2;
      expect(fetcher).toHaveBeenCalledTimes(readsBeforeUnmount);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      expect(fetcher.mock.calls[0]?.[0]).toBe(
        '/api/v1/cms/patterns/profile-hero',
      );
      expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
      const path = window.location.pathname;
      const search = window.location.search;
      view.unmount();
      await advance(1);
      expect(fetcher).toHaveBeenCalledTimes(readsBeforeUnmount);
      await advance(10_000);
      expect(fetcher).toHaveBeenCalledTimes(readsBeforeUnmount);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe(path);
      expect(window.location.search).toBe(search);
    },
  );
});
