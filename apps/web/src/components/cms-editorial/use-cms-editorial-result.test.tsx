// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { saveCmsEditorialResult } from './cms-editorial-result-save';
import { CMS_EDITORIAL_RESULT_SCOPE } from './cms-editorial-result-scope';
import { useCmsEditorialResult } from './use-cms-editorial-result';

/*
 * The editor reads the result a command left for it after hydration (the server render has no tab
 * storage). The peek asks first, so a page nobody navigated to from a command reads nothing.
 */
const ENTRY = '2f6b7d1a-3c4e-4f50-8a9b-0c1d2e3f4a5b';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  window.sessionStorage.clear();
});

function Probe({ entryId }: { entryId: string }): React.ReactElement {
  const summary = useCmsEditorialResult(entryId);
  return <p data-result={summary === null ? 'none' : summary.kind} />;
}

const result = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-result]')?.getAttribute('data-result');

describe('useCmsEditorialResult', () => {
  it('reports no result and reads nothing when none is waiting', async () => {
    const { container } = mountElement(<Probe entryId={ENTRY} />);
    await flush();
    expect(result(container)).toBe('none');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('reports the result a command left for this entry, once', async () => {
    saveCmsEditorialResult(window.sessionStorage, {
      kind: 'created',
      entryId: ENTRY,
      revisionNumber: '1',
      entryVersion: '1',
      state: 'draft',
      parentRevisionIds: [],
      migrationChainId: null,
      edgeCount: null,
    });
    const { container } = mountElement(<Probe entryId={ENTRY} />);
    await flush();
    expect(result(container)).toBe('created');
    // The record is consumed by the read.
    expect(
      window.sessionStorage.getItem(
        `wj-step-up-draft:${CMS_EDITORIAL_RESULT_SCOPE}`,
      ),
    ).toBeNull();
  });

  it('shows nothing for a result left for another entry and clears it', async () => {
    saveCmsEditorialResult(window.sessionStorage, {
      kind: 'created',
      entryId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
      revisionNumber: '1',
      entryVersion: '1',
      state: 'draft',
      parentRevisionIds: [],
      migrationChainId: null,
      edgeCount: null,
    });
    const { container } = mountElement(<Probe entryId={ENTRY} />);
    await flush();
    expect(result(container)).toBe('none');
  });
});
