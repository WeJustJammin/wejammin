// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateTo = vi.hoisted(() => vi.fn());
vi.mock('./cms-capability-grant-navigation', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('./cms-capability-grant-navigation')
  >()),
  navigateTo,
}));
vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import { grantListPage } from '../../server/cms-capability-grant.test-support';
import {
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  GRANT_UUID,
  click,
  mountConsole,
  query,
  scriptFetch,
  settle,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03 owner grant console interactions: local validation, the pending ->
 * result-heading flow, the refetch-after-command rule, and every error row of
 * the DEC-119 command table. No person identifier is announced or stored.
 */

let mounted: Mounted | null = null;
const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};
const grantListResponse = () => jsonResponse(200, grantListPage(sampleItems()));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
  navigateTo.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('[DEC-119] list controls', () => {
  it('sorting by valid-through refetches, updates aria-sort and the URL without a person id', async () => {
    const { calls } = scriptFetch(() => grantListResponse());
    const root = mount();
    click(query(root, 'th button[data-sort="validThrough"]'));
    await settle();
    expect(calls[0]?.url).toContain('sort=validThrough');
    expect(window.location.search).toContain('sort=validThrough');
    expect(
      query(root, 'th[aria-sort]').querySelector('button')?.dataset.sort,
    ).toBe('validThrough');
  });

  it('keeps the person filter island-local: sent in the fetch, never in the URL', async () => {
    const { calls } = scriptFetch(() => grantListResponse());
    const root = mount();
    typeInto(query(root, 'input[name="filterPerson"]'), GRANT_UUID);
    await settle();
    expect(calls.at(-1)?.url).toContain(`subjectPersonId=${GRANT_UUID}`);
    expect(window.location.search).not.toContain(GRANT_UUID);
    expect(window.location.href).not.toContain(GRANT_UUID);
  });

  it('filters by capability and state through URL state and resets them', async () => {
    const { calls } = scriptFetch(() => grantListResponse());
    const root = mount();
    typeInto(query(root, 'select[name="filterCapability"]'), 'cms.editor');
    await settle();
    expect(calls.at(-1)?.url).toContain('capability=cms.editor');
    expect(window.location.search).toContain('capability=cms.editor');
    click(query(root, 'button[data-action="reset-filters"]'));
    await settle();
    expect(calls.at(-1)?.url).not.toContain('capability=');
  });

  it('shows an error state with retry when a refetch fails and never empties the page', async () => {
    scriptFetch(() =>
      jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'), {
        'retry-after': '3',
      }),
    );
    const root = mount();
    click(query(root, 'th button[data-sort="validThrough"]'));
    await settle();
    expect(query(root, '[data-cms-retry-control]')).not.toBeNull();
    expect(root.querySelector('tr[data-grant-id]')).not.toBeNull();
  });
});
