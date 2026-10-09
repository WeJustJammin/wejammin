// @vitest-environment jsdom

import { EntryListPageSchema } from '@wejammin/contracts';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialEntryList from './CmsEditorialEntryList';

/**
 * Slice 10 evidence lane EC (P2-S10-AC-099): the CMS-03B-13 entry list is a
 * server-first page, so the tab order IS the document order, every stop is a native
 * control, and every row is a row the server returned: nothing in the component can
 * add, reorder or fabricate one.
 */

const ROUTE = '/app/cms-content-modeling/entries';
const entryId = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-68f7ecf1${String(n).padStart(4, '0')}`;

const row = (n: number) => ({
  id: `018f0c45-73fe-7dc2-9c09-68f7ecf2${String(n).padStart(4, '0')}`,
  entryId: entryId(n),
  revisionNumber: String(n),
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-05T00:00:00Z',
  authorClass: 'human',
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-05T01:00:00Z',
});

const page = (count: number, nextCursor: string | null = null) =>
  EntryListPageSchema.parse({
    items: Array.from({ length: count }, (_, index) => row(index + 1)),
    nextCursor,
    pageVersion: '1',
  });

const markup = (
  value: ReturnType<typeof page>,
  query: Record<string, string> = {},
): string =>
  renderToStaticMarkup(
    <CmsEditorialEntryList page={value} routePath={ROUTE} query={query} />,
  );

const parse = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** Tab sequence of a fragment: positive tabindex first, then document order, no -1. */
const tabOrder = (root: HTMLElement): readonly Element[] => {
  const stops = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (element) => element.getAttribute('tabindex') !== '-1',
  );
  const positive = stops
    .filter((element) => Number(element.getAttribute('tabindex') ?? '0') > 0)
    .sort(
      (a, b) =>
        Number(a.getAttribute('tabindex')) - Number(b.getAttribute('tabindex')),
    );
  return [
    ...positive,
    ...stops.filter(
      (element) => Number(element.getAttribute('tabindex') ?? '0') <= 0,
    ),
  ];
};

const label = (element: Element): string =>
  element.tagName === 'A'
    ? `a:${element.getAttribute('href') ?? ''}`
    : `${element.tagName.toLowerCase()}#${element.getAttribute('id') ?? element.textContent ?? ''}`;

describe('EC-099 entry list keyboard order', () => {
  it('tabs through the filter controls, then the create link, then each entry in server order, then the next page', () => {
    const root = parse(markup(page(3, 'next-token'), { limit: '3' } as never));
    expect(tabOrder(root).map(label)).toEqual([
      'select#entry-state-filter',
      'input#entry-content-type-filter',
      'button#Filter entries',
      `a:${ROUTE}/new`,
      `a:${ROUTE}/${entryId(1)}`,
      `a:${ROUTE}/${entryId(1)}/workflow`,
      `a:${ROUTE}/${entryId(2)}`,
      `a:${ROUTE}/${entryId(2)}/workflow`,
      `a:${ROUTE}/${entryId(3)}`,
      `a:${ROUTE}/${entryId(3)}/workflow`,
      expect.stringMatching(
        /^a:\/app\/cms-content-modeling\/entries\?.*cursor=next-token/u,
      ),
    ]);
  });

  it('keeps a single action after the filter controls when the list is empty', () => {
    const none = parse(markup(page(0)));
    expect(tabOrder(none).map(label)).toEqual([
      'select#entry-state-filter',
      'input#entry-content-type-filter',
      'button#Filter entries',
      `a:${ROUTE}/new`,
    ]);
    const filtered = parse(markup(page(0), { state: 'draft' }));
    expect(tabOrder(filtered).map(label)).toEqual([
      'select#entry-state-filter',
      'input#entry-content-type-filter',
      'button#Filter entries',
      `a:${ROUTE}#entry-list-title`,
    ]);
  });

  it('never reorders the tab sequence with a positive tabindex and offers only native controls', () => {
    const root = parse(markup(page(5, 'c')));
    expect(
      root.querySelectorAll('[tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(0);
    expect(
      root.querySelectorAll(
        '[role="button"], [role="link"], [onclick], [draggable]',
      ),
    ).toHaveLength(0);
    const tags = new Set(tabOrder(root).map((element) => element.tagName));
    expect([...tags].sort()).toEqual(['A', 'BUTTON', 'INPUT', 'SELECT']);
  });

  it('makes the heading the programmatic focus target that both the filter and the next link return to', () => {
    const root = parse(markup(page(2, 'c')));
    const heading = root.querySelector('h2');
    expect(heading?.getAttribute('id')).toBe('entry-list-title');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('form')?.getAttribute('action')).toBe(
      `${ROUTE}#entry-list-title`,
    );
    expect(root.querySelector('nav a')?.getAttribute('href')).toMatch(
      /#entry-list-title$/u,
    );
    expect(root.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
      'entry-list-title',
    );
  });
});

describe('EC-099 entry list shows no optimistic row', () => {
  it('renders exactly the rows the server page holds, in the order it holds them', () => {
    for (const count of [0, 1, 7, 50]) {
      const root = parse(markup(page(count)));
      expect(root.querySelectorAll('li')).toHaveLength(count);
      expect(
        Array.from(root.querySelectorAll('li a')).map((anchor) =>
          anchor.getAttribute('href'),
        ),
      ).toEqual(
        // Slice 11 (FE03 route rows): each row also links to its workflow.
        Array.from({ length: count }, (_, index) => [
          `${ROUTE}/${entryId(index + 1)}`,
          `${ROUTE}/${entryId(index + 1)}/workflow`,
        ]).flat(),
      );
    }
  });

  it('is a pure function of the server page: the same page is byte-identical and a new row appears only when the page carries it', () => {
    const first = page(2);
    expect(markup(first)).toBe(markup(first));
    const before = parse(markup(page(2)));
    const after = parse(markup(page(3)));
    expect(after.querySelectorAll('li')).toHaveLength(
      before.querySelectorAll('li').length + 1,
    );
  });

  it('carries no pending, busy or placeholder state and no script', () => {
    const html = markup(page(2, 'c'));
    expect(html).not.toMatch(
      /aria-busy|data-optimistic|data-pending|skeleton|placeholder|<script/u,
    );
    const root = parse(html);
    expect(root.querySelector('form')?.getAttribute('method')).toBe('get');
    expect(root.querySelectorAll('form[method="post" i]')).toHaveLength(0);
  });

  it('announces the loaded count through one polite status and never an alert', () => {
    const root = parse(markup(page(2)));
    const status = root.querySelector('[data-cms-editorial-list-status]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('2 entries loaded.');
    expect(root.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });
});
