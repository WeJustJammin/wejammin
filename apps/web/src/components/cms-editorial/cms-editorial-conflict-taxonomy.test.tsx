// @vitest-environment jsdom

/**
 * The CMS-06 conflict form over a CMS-03C-17 taxonomy field (BE03b CMS-03B-02
 * and CMS-03B-12; BE03c CMS-03C-17; FE03 "Slice 12 governed definition,
 * composition, taxonomy, locale and related-content surfaces").
 *
 * A divergent taxonomy field's explicit replacement is edited with the REAL
 * connected taxonomy control: the host binds the selector scope it read
 * elsewhere (the server-derived type key, the exact conflict locale and the
 * stable field key) and the island's own fetcher, so the first read is
 * `GET /api/v1/cms/taxonomies/selector` with exactly typeKey/fieldKey/locale
 * and limit=50.
 * A chosen term is submitted as the existing conflict choice value
 * `{ termIds }` and nothing else; a verified 422 `VALIDATION_FAILED` naming
 * `term_unavailable` is the only thing that re-reads the selector, and it never
 * edits a choice.
 *
 * These render the REAL island with the REAL conflict transports and only
 * `fetch` replaced: component/transport integration, never a real E2E run.
 */

import { act } from 'react';
import * as React from 'react';
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
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialConflictResolveIsland from './CmsEditorialConflictResolveIsland';
import { COPY } from './cms-editorial-conflict-copy';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';
import { CMS_EDITORIAL_REASON_COPY } from './cms-editorial-reason-copy';
import {
  GUITAR,
  LOCALE,
  SELECTOR_PATH,
  TAXONOMY_FIELD_KEY,
  TOPICS,
  TYPE_KEY,
  resolved,
  selectorResponse,
  taxonomyInit,
  termUnavailable,
} from './conflict-taxonomy-fixtures.test-support';
import { settleAsyncWork } from './cms-editorial-fake-clock.test-support';
import { TITLE } from './cms-editorial-editor-fixtures.test-support';

beforeAll(enableReactAct);
// This semantic host test preloads the lazily imported transports, exactly as
// the island tests do, so a cold dynamic import cannot outrun `settle`; the
// production island still loads them on first resolve (no cold-load proof).
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

const pathOf = (url: string): string => {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
};
const searchOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)));
const selectorGets = (calls: readonly Call[]): readonly Call[] =>
  calls.filter(
    (call) => call.method === 'GET' && pathOf(call.url) === SELECTOR_PATH,
  );
const resolvePosts = (calls: readonly Call[]): readonly Call[] =>
  calls.filter((call) => call.method === 'POST');
const bodyOf = (call: Call | undefined): Record<string, unknown> =>
  JSON.parse(String(call?.body ?? '{}')) as Record<string, unknown>;
const statusOf = (container: HTMLElement): string =>
  container.querySelector('[data-cms-editorial-status]')?.textContent ?? '';

const mountConflict = (script: {
  readonly selectors?: readonly Response[];
  readonly steps?: readonly (Response | Error)[];
}) => {
  const selectors = [...(script.selectors ?? [])];
  const steps = [...(script.steps ?? [])];
  const calls: Call[] = [];
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialConflictResolveIsland
      init={taxonomyInit()}
      navigate={navigate}
      fetcher={async (input, requestInit) => {
        const url = String(input);
        calls.push({
          url,
          method: requestInit?.method ?? 'GET',
          headers: new Headers(requestInit?.headers),
          body: typeof requestInit?.body === 'string' ? requestInit.body : null,
        });
        const queue = pathOf(url) === SELECTOR_PATH ? selectors : steps;
        const step = queue.shift();
        if (step === undefined) throw new Error(`unexpected request ${url}`);
        if (step instanceof Error) throw step;
        return step;
      }}
    />,
  );
  return { ...mounted, calls, navigate };
};

const radio = (
  container: HTMLElement,
  fieldLabel: string,
  name: string,
): HTMLInputElement => {
  const group = Array.from(container.querySelectorAll('fieldset')).find(
    (fieldset) => fieldset.querySelector('legend')?.textContent === fieldLabel,
  );
  const label = Array.from(group?.querySelectorAll('label') ?? []).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  const input = label?.querySelector('input') ?? null;
  if (input === null) throw new Error(`No radio ${name} for ${fieldLabel}`);
  return input as HTMLInputElement;
};

const settle = async (): Promise<void> => {
  await flush();
  await act(async () => {
    await settleAsyncWork();
  });
};

const chooseExplicitTaxonomyTerm = async (
  container: HTMLElement,
): Promise<void> => {
  await click(radio(container, 'Topics', 'Use a new value'));
  await settle();
  await click(byLabel<HTMLInputElement>(container, 'Guitar'));
};

const submit = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Resolve conflict'));
  await settle();
};

describe('CmsEditorialConflictResolveIsland: a taxonomy explicit choice', () => {
  it('reads the selector with the server-derived type key, the stable field key and the exact locale, and submits only { termIds }', async () => {
    const { container, calls } = mountConflict({
      selectors: [selectorResponse()],
      steps: [resolved()],
    });
    expect(selectorGets(calls)).toHaveLength(0);
    await chooseExplicitTaxonomyTerm(container);
    const gets = selectorGets(calls);
    expect(gets).toHaveLength(1);
    expect(searchOf(gets[0]!.url)).toEqual({
      typeKey: TYPE_KEY,
      fieldKey: TAXONOMY_FIELD_KEY,
      locale: LOCALE,
      limit: '50',
    });
    // The scope names the field's stable key, never the explicit control's DOM id.
    expect(searchOf(gets[0]!.url).fieldKey).not.toBe(`${TOPICS}-explicit`);
    const guitar = byLabel<HTMLInputElement>(container, 'Guitar');
    expect(guitar.getAttribute('type')).toBe('checkbox');
    expect(guitar.value).toBe(GUITAR);
    expect(guitar.checked).toBe(true);

    await click(radio(container, 'Title', 'Keep their version'));
    await submit(container);
    const posts = resolvePosts(calls);
    expect(posts).toHaveLength(1);
    const body = bodyOf(posts[0]);
    expect(body.choices).toEqual([
      { path: `/fields/${TITLE}`, choice: 'theirs' },
      {
        path: `/fields/${TOPICS}`,
        choice: 'explicit',
        value: { termIds: [GUITAR] },
      },
    ]);
    const explicit = (body.choices as Array<Record<string, unknown>>).find(
      (choice) => choice.choice === 'explicit',
    ) as Record<string, unknown>;
    expect(Object.keys(explicit.value as object)).toEqual(['termIds']);
    // No scope, locale or context operand rides along with the choice.
    expect(Object.keys(body).sort()).toEqual([
      'baseRevision',
      'choices',
      'conflictId',
      'entryId',
      'expectedVersion',
    ]);
  });

  it('refreshes the selector once on a verified 422 term_unavailable and keeps every choice and the stale selection', async () => {
    const { container, calls } = mountConflict({
      selectors: [selectorResponse(), selectorResponse()],
      steps: [termUnavailable()],
    });
    await chooseExplicitTaxonomyTerm(container);
    await click(radio(container, 'Title', 'Keep their version'));
    await submit(container);
    expect(resolvePosts(calls)).toHaveLength(1);
    const gets = selectorGets(calls);
    expect(gets).toHaveLength(2);
    expect(searchOf(gets[1]!.url)).toEqual(searchOf(gets[0]!.url));
    expect(radio(container, 'Title', 'Keep their version').checked).toBe(true);
    expect(radio(container, 'Topics', 'Use a new value').checked).toBe(true);
    expect(byLabel<HTMLInputElement>(container, 'Guitar').checked).toBe(true);
    expect(statusOf(container)).toContain(
      CMS_EDITORIAL_REASON_COPY.term_unavailable,
    );
    expect(statusOf(container)).not.toContain(
      'Server text that must never be shown.',
    );
    // The refusal is never resent on its own.
    await settle();
    expect(resolvePosts(calls)).toHaveLength(1);
  });

  it('keeps the replay bytes and key for an unknown outcome and never refreshes the selector', async () => {
    const { container, calls } = mountConflict({
      selectors: [selectorResponse()],
      steps: [new TypeError('Failed to fetch'), resolved()],
    });
    await chooseExplicitTaxonomyTerm(container);
    await click(radio(container, 'Title', 'Keep their version'));
    await submit(container);
    expect(statusOf(container)).toBe(COPY.unknown);
    expect(selectorGets(calls)).toHaveLength(1);
    const first = resolvePosts(calls)[0]!;
    await click(buttonNamed(container, 'Retry resolve'));
    await settle();
    const posts = resolvePosts(calls);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toBe(first.body);
    expect(posts[1]!.headers.get('idempotency-key')).toBe(
      first.headers.get('idempotency-key'),
    );
    expect(selectorGets(calls)).toHaveLength(1);
  });
});
