// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseContentSchemaRegistryQuery } from '../../server/content-schema-registry-contracts';
import type { ContentSchemaRegistryListPage } from './content-schema-registry-types';
import ContentSchemaRegistryFilterBar, {
  contentSchemaRegistryFilterSummary,
} from './ContentSchemaRegistryFilterBar';
import ContentSchemaRegistryList from './ContentSchemaRegistryList';
import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';

/**
 * R8 proofs for AC249: the registry list exposes its sort direction, the result
 * count and the active-filter summary as text, and the sorted column carries
 * `aria-sort` so assistive technology hears the order, not just a select value.
 */

const queryFor = (search: string) =>
  parseContentSchemaRegistryQuery(
    new URL(`https://app.example.test/app/cms-content-modeling${search}`),
  );

const PAGE: ContentSchemaRegistryListPage = {
  items: [
    {
      resourceKind: 'content_type',
      id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
      version: '4',
      typeKey: 'release_note',
      builtIn: false,
      lifecycle: 'active',
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    },
  ],
  nextCursor: null,
};

const doc = (markup: string): Document =>
  new DOMParser().parseFromString(`<body>${markup}</body>`, 'text/html');

const list = () =>
  doc(
    renderToStaticMarkup(
      <ContentSchemaRegistryList
        page={PAGE}
        canonicalUrl="/app/cms-content-modeling"
        listUrl="/app/cms-content-modeling"
      />,
    ),
  );

describe('[P2-S09-AC-249] result count and active-filter summary', () => {
  const status = (resultCount: number, summary: string) =>
    doc(
      renderToStaticMarkup(
        <ContentSchemaRegistryStatus
          state={{ status: 'success', data: PAGE, version: '1', stale: false }}
          regionLabel="Registry list"
          supportReference="support-1"
          canonicalUrl="/app/cms-content-modeling"
          resultCount={resultCount}
          activeFilterSummary={summary}
        />,
      ),
    ).body.textContent ?? '';

  it('[P2-S09-AC-249] states the plural result count', () => {
    expect(status(3, 'No filters are applied.')).toContain(
      '3 registry records shown.',
    );
  });

  it('[P2-S09-AC-249] states the singular result count', () => {
    expect(status(1, 'No filters are applied.')).toContain(
      '1 registry record shown.',
    );
  });

  it('[P2-S09-AC-249] lists every active filter in the summary', () => {
    const summary = contentSchemaRegistryFilterSummary(
      queryFor('?resourceKind=content_type&keyPrefix=rel&lifecycle=active'),
    );
    expect(summary).toBe(
      'Active filters: resource kind content_type; key prefix rel; lifecycle active.',
    );
    expect(status(1, summary)).toContain(summary);
  });
});

describe('[P2-S09-AC-249] sort direction', () => {
  it('[P2-S09-AC-249] states the sort key and direction as text beside the filter summary', () => {
    const markup = renderToStaticMarkup(
      <ContentSchemaRegistryFilterBar
        query={queryFor('?sort=version&direction=desc')}
        canonicalUrl="/app/cms-content-modeling"
      />,
    );
    const document = doc(markup);
    expect(
      document.querySelector('#content-schema-registry-sort-summary')
        ?.textContent,
    ).toBe('Sorted by Version, descending.');
    expect(
      document
        .querySelector('form')
        ?.getAttribute('aria-describedby')
        ?.split(' '),
    ).toContain('content-schema-registry-sort-summary');
  });

  it('[P2-S09-AC-249] marks exactly the sorted column header with aria-sort', () => {
    const markup = renderToStaticMarkup(
      <ContentSchemaRegistryList
        page={PAGE}
        canonicalUrl="/app/cms-content-modeling"
        listUrl="/app/cms-content-modeling"
        sort={{ sort: 'version', direction: 'asc' }}
      />,
    );
    const headers = [...doc(markup).querySelectorAll('th[aria-sort]')];
    expect(headers.map((header) => header.textContent)).toEqual(['Version']);
    expect(headers[0]?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('[P2-S09-AC-249] sets no aria-sort when the sort key is not a visible column', () => {
    const markup = renderToStaticMarkup(
      <ContentSchemaRegistryList
        page={PAGE}
        canonicalUrl="/app/cms-content-modeling"
        listUrl="/app/cms-content-modeling"
        sort={{ sort: 'createdAt', direction: 'desc' }}
      />,
    );
    expect(doc(markup).querySelectorAll('th[aria-sort]')).toHaveLength(0);
    expect(list().querySelectorAll('th[aria-sort]')).toHaveLength(0);
  });
});
