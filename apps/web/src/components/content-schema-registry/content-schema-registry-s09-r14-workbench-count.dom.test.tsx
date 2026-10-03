// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseContentSchemaRegistryQuery } from '../../server/content-schema-registry-contracts';
import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import {
  CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
  type ContentSchemaRegistryListPage,
  type ContentSchemaRegistryWorkbenchProps,
} from './content-schema-registry-types';

/**
 * AC249 through the real composition: the workbench derives the result count
 * from the page it was given (`items.length`) and the filter summary from the
 * validated query. Nothing here injects a count or a summary, so a count that
 * disagrees with the rendered rows cannot pass.
 */

const record = (index: number) =>
  ({
    resourceKind: 'content_type',
    id: `018f0c45-73fe-7dc2-9c09-68f7ecf132d${String(index)}`,
    version: '4',
    typeKey: `release_note_${String(index)}`,
    builtIn: false,
    lifecycle: 'active',
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  }) as const;

const pageOf = (size: number): ContentSchemaRegistryListPage => ({
  items: Array.from({ length: size }, (_, index) => record(index + 1)),
  nextCursor: null,
});

const SEARCH = '?resourceKind=content_type&keyPrefix=rel&lifecycle=active';

const renderWorkbench = (size: number, search = ''): Document => {
  const props: ContentSchemaRegistryWorkbenchProps = {
    initialList: {
      status: 'success',
      data: pageOf(size),
      version: '4',
      stale: false,
    },
    initialDetail: null,
    variant: 'entitledRead',
    access: 'read-only',
    query: parseContentSchemaRegistryQuery(
      new URL(`https://app.example.test/app/cms-content-modeling${search}`),
    ),
    contentTypeId: null,
    versionId: null,
    cursor: null,
    expectedVersion: null,
    supportReference: 'SR-0A1B-2C3D-4E5F-6A7B',
    canonicalUrl: '/app/cms-content-modeling',
    listUrl: '/app/cms-content-modeling',
    retryUrl: '/app/cms-content-modeling',
    csrfToken: 'csrf-token',
    onCanonicalRefetch: async () => undefined,
    contractFields: CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
  };
  return new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(React.createElement(ContentSchemaRegistryWorkbench, props))}</body>`,
    'text/html',
  );
};

const rows = (document: Document): number =>
  document.querySelectorAll('tbody tr').length;

describe('[P2-S09-AC-249] the workbench result count is the rendered row count', () => {
  it('[P2-S09-AC-249] a one-item page says "1 registry record shown." and renders exactly one row', () => {
    const document = renderWorkbench(1);
    expect(rows(document)).toBe(1);
    expect(document.body.textContent).toContain('1 registry record shown.');
    expect(document.body.textContent).not.toMatch(/\b3 registry records/u);
  });

  it('[P2-S09-AC-249] a three-item page says "3 registry records shown." and renders exactly three rows', () => {
    const document = renderWorkbench(3);
    expect(rows(document)).toBe(3);
    expect(document.body.textContent).toContain('3 registry records shown.');
  });

  it('[P2-S09-AC-249] the workbench states every active filter from the validated query', () => {
    const document = renderWorkbench(1, SEARCH);
    expect(document.body.textContent).toContain(
      'Active filters: resource kind content_type; key prefix rel; lifecycle active.',
    );
  });

  it('[P2-S09-AC-261] a full 100-row page renders exactly 100 rows with no client windowing', () => {
    const document = renderWorkbench(100);
    expect(rows(document)).toBe(100);
    expect(document.body.textContent).toContain('100 registry records shown.');
  });
});
