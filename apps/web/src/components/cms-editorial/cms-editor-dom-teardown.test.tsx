// @vitest-environment jsdom

import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialEntryEditorIsland from './CmsEditorialEntryEditorIsland';
import {
  TITLE,
  editorFields,
  editorInit,
} from './cms-editorial-editor-fixtures.test-support';

/*
 * Regression guard for the CI-only "ReferenceError: window is not defined"
 * (react-dom-client, via scheduler performWorkUntilDeadline). A draft-editor
 * island that is left mounted keeps its 3 s idle and 30 s maximum autosave
 * timers alive; when one fires after its test (and, under coverage, after the
 * jsdom environment) is gone, React schedules work against a missing window.
 * `mountElement` therefore unmounts every root it created after each test, the
 * way the other Slice 10 editor tests already do with `unmountAll`.
 *
 * The two tests are deliberately ordered: the first leaves a dirty editor
 * mounted and does not clean up after itself; the second observes what the
 * driver's own afterEach left behind. Fake timers make "a timer is pending"
 * observable without sleeping.
 */
const requests: string[] = [];

beforeAll(() => {
  enableReactAct();
  vi.useFakeTimers();
});
afterAll(() => {
  vi.useRealTimers();
  disableReactAct();
});

describe('DOM driver teardown', () => {
  it('arms both autosave timers while a draft edit is unsent, and leaves the island mounted', async () => {
    document.cookie = 'wj_csrf=csrf-token';
    const { container } = mountElement(
      React.createElement(CmsEditorialEntryEditorIsland, {
        init: editorInit({ fields: editorFields() }),
        fetcher: async (input) => {
          requests.push(String(input));
          throw new Error('no request is expected');
        },
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
    await typeInto(
      container.querySelector(`#field-${TITLE}`) as HTMLInputElement,
      'A changed title',
    );
    expect(vi.getTimerCount()).toBe(2);
  });

  it('left no timer pending and no root mounted by the previous test', async () => {
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(35_000);
    expect(requests).toEqual([]);
  });
});
