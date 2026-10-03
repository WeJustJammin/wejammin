// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryResourceKindSchema,
} from '@wejammin/contracts';

import ContentSchemaRegistryFilterBar from './ContentSchemaRegistryFilterBar';
import ContentSchemaRegistryList from './ContentSchemaRegistryList';
import ContentSchemaRegistryOfflineStatus from './ContentSchemaRegistryOfflineStatus';
import ContentSchemaRegistrySyncConflict from './ContentSchemaRegistrySyncConflict';
import { renderConflict } from './content-schema-registry-runtime-dom-renderers';
import {
  forwardedQuery,
  parseContentSchemaRegistryContextHeaders,
} from '../../server/content-schema-registry-platform-context';
import { parseContentSchemaRegistryQuery } from '../../server/content-schema-registry-contracts';
import {
  TYPE_ID,
  VERSION_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

void parseContentSchemaRegistryContextHeaders;

const QUERY = { limit: 25, sort: 'key', direction: 'asc' } as const;
const HASH = 'c'.repeat(64);
const resource = draftDetail().resource;
const listPage = ContentSchemaRegistryListPageSchema.parse({
  items: [
    {
      resourceKind: 'content_type',
      id: TYPE_ID,
      version: '4',
      typeKey: 'release_note',
      builtIn: false,
      lifecycle: 'active',
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    },
    resource,
    {
      resourceKind: 'block_definition_registry_record',
      id: VERSION_ID,
      version: '2',
      blockKey: 'hero.banner',
      blockVersion: 2,
      propsSchemaRef: 'cms/hero-banner',
      propsSchemaHash: HASH,
      rendererRef: 'blocks/hero-banner',
      releaseDigest: HASH,
      lifecycle: 'supported',
    },
  ],
  nextCursor: 'opaque-next-cursor',
});
const listDocument = (
  query: Record<string, unknown> = QUERY,
  canonical = '/app/cms-content-modeling',
): Document =>
  new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(
      <>
        <ContentSchemaRegistryFilterBar
          query={query as never}
          canonicalUrl={canonical}
        />
        <ContentSchemaRegistryList
          page={listPage}
          canonicalUrl={canonical}
          listUrl={`${canonical}?limit=25&sort=key&direction=asc`}
          sort={{ sort: 'key', direction: 'asc' }}
          query={{ ...QUERY, ...query } as never}
        />
      </>,
    )}</body>`,
    'text/html',
  );
const filterForm = (document: Document): HTMLFormElement =>
  document.querySelector(
    'form.content-schema-registry-filters',
  ) as HTMLFormElement;
const submittedQuery = (form: HTMLFormElement): URL =>
  new URL(
    `https://app.test/app/cms-content-modeling?${new URLSearchParams(new FormData(form) as never).toString()}`,
  );

describe('[P2-S09-AC-228] the protected list is typed URL state', () => {
  it('commits exactly the eight typed query keys through a GET form and the untouched form is a valid query', () => {
    const form = filterForm(listDocument());
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe('/app/cms-content-modeling');
    expect([...new Set([...new FormData(form).keys()])].sort()).toEqual([
      'direction',
      'keyPrefix',
      'lifecycle',
      'limit',
      'resourceKind',
      'sort',
      'state',
    ]);
    const url = submittedQuery(form);
    expect(parseContentSchemaRegistryQuery(url)).toMatchObject({
      limit: 25,
      sort: 'key',
      direction: 'asc',
    });
    expect(forwardedQuery(url)).toBe('?limit=25&sort=key&direction=asc');
  });

  it('offers every value of each generated enum and nothing the schema refuses', () => {
    const doc = listDocument();
    const options = (name: string) =>
      [
        ...doc.querySelectorAll<HTMLOptionElement>(
          `select[name="${name}"] option`,
        ),
      ]
        .map((option) => option.value)
        .filter((value) => value !== '');
    expect(options('resourceKind').sort()).toEqual(
      [...ContentSchemaRegistryResourceKindSchema.options].sort(),
    );
    const accepted = (key: string, values: readonly string[]) =>
      values.filter(
        (value) =>
          ContentSchemaRegistryListQuerySchema.safeParse({ [key]: value })
            .success,
      );
    const candidates = [
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
      'compiled',
      'deprecated',
      'supported',
      'withdrawn',
      'bogus',
    ];
    expect(options('state').sort()).toEqual(
      accepted('state', candidates).sort(),
    );
    expect(options('lifecycle').sort()).toEqual(
      accepted('lifecycle', candidates).sort(),
    );
    expect(options('sort').sort()).toEqual([
      'createdAt',
      'key',
      'updatedAt',
      'version',
    ]);
    expect(options('direction').sort()).toEqual(['asc', 'desc']);
    const limit = doc.querySelector<HTMLInputElement>('input[name="limit"]');
    expect([limit?.min, limit?.max]).toEqual(['1', '100']);
    expect(
      doc
        .querySelector<HTMLInputElement>('input[name="keyPrefix"]')
        ?.getAttribute('pattern'),
    ).toBe('[a-z][a-z0-9._-]{0,63}');
  });

  it('carries each applied value in the URL and keeps the cursor and every row link free of record payload', () => {
    const doc = listDocument({
      ...QUERY,
      resourceKind: 'content_type',
      keyPrefix: 'rel',
      lifecycle: 'active',
      limit: 10,
      sort: 'version',
      direction: 'desc',
    });
    const url = submittedQuery(filterForm(doc));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      resourceKind: 'content_type',
      keyPrefix: 'rel',
      lifecycle: 'active',
      state: '',
      limit: '10',
      sort: 'version',
      direction: 'desc',
    });
    const hrefs = [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')].map(
      (anchor) => anchor.getAttribute('href') as string,
    );
    const allowed = new Set([
      'resourceKind',
      'keyPrefix',
      'lifecycle',
      'state',
      'limit',
      'cursor',
      'sort',
      'direction',
    ]);
    for (const href of hrefs) {
      const parsed = new URL(href, 'https://app.test');
      for (const key of parsed.searchParams.keys())
        expect(allowed.has(key), `${href} ${key}`).toBe(true);
      expect(href).not.toMatch(
        /release_note|Release note|hero\.banner|cms\/hero-banner|c{64}/u,
      );
    }
    const next = hrefs.find((href) => href.includes('cursor='));
    expect(
      new URL(next ?? '', 'https://app.test').searchParams.get('cursor'),
    ).toBe('opaque-next-cursor');
    expect(
      new URL(next ?? '', 'https://app.test').searchParams.get('sort'),
    ).toBe('key');
  });
});

describe('[P2-S09-AC-229] the protected detail is addressed by exact path ids', () => {
  it('builds every detail link from the record ids, never from a label or a list position', () => {
    const doc = listDocument();
    const links = [
      ...doc.querySelectorAll<HTMLAnchorElement>('a[data-cms-focus-key]'),
    ].map((anchor) => anchor.getAttribute('href'));
    expect(new Set(links).size).toBe(1);
    expect(links[0]).toBe(
      `/app/cms-content-modeling/${resource.contentTypeId}/versions/${resource.id}?limit=25&sort=key&direction=asc`,
    );
    const reversed = ContentSchemaRegistryListPageSchema.parse({
      ...listPage,
      items: [...listPage.items].reverse(),
    });
    const reorderedDoc = new DOMParser().parseFromString(
      `<body>${renderToStaticMarkup(<ContentSchemaRegistryList page={reversed} canonicalUrl="/app/cms-content-modeling" listUrl="/app/cms-content-modeling?limit=25&sort=key&direction=asc" />)}</body>`,
      'text/html',
    );
    expect(
      [...reorderedDoc.querySelectorAll('a[data-cms-focus-key]')].map(
        (anchor) => anchor.getAttribute('href'),
      ),
    ).toEqual(links);
    for (const href of links)
      expect(href).not.toMatch(/release_note|Release%20note|\/0\/|index=/u);
  });

  it('renders the detail only for the exact ids the page was composed for', () => {
    const doc = renderDocument(versionPageProps());
    expect(
      doc
        .querySelector('form[data-operation-id="CMS-03A-02"]')
        ?.getAttribute('action'),
    ).toBe(`/app/cms-content-modeling/${TYPE_ID}/versions/${resource.id}`);
    for (const form of doc.querySelectorAll<HTMLFormElement>(
      'form[data-cms-command-form]',
    )) {
      const ids = ['contentTypeId', 'versionId'].map(
        (name) =>
          form.querySelector<HTMLInputElement>(`input[name="${name}"]`)
            ?.value ?? '',
      );
      if (ids[0] !== '') expect(ids).toEqual([TYPE_ID, resource.id]);
    }
  });
});

describe('FilterBar blank filters (the Apply button must produce a valid URL)', () => {
  it('[P2-S09-AC-228] [P2-S09-AC-238] treats a blank filter as no filter on both the page query and the Worker forward', () => {
    const url = new URL(
      'https://app.test/app/cms-content-modeling?resourceKind=&keyPrefix=&lifecycle=&state=&limit=25&sort=key&direction=asc&cursor=',
    );
    expect(parseContentSchemaRegistryQuery(url)).toStrictEqual({
      limit: 25,
      sort: 'key',
      direction: 'asc',
    });
    expect(forwardedQuery(url)).toBe('?limit=25&sort=key&direction=asc');
    expect(() =>
      parseContentSchemaRegistryQuery(
        new URL('https://app.test/x?resourceKind=bogus'),
      ),
    ).toThrow();
    expect(() =>
      parseContentSchemaRegistryQuery(new URL('https://app.test/x?limit=0')),
    ).toThrow();
  });
});

describe('[P2-S09-AC-241] OfflineStatus and SyncConflict use text plus an icon', () => {
  it('the server-rendered SyncConflict leads its heading with a decorative icon and states both versions', () => {
    const doc = new DOMParser().parseFromString(
      `<body>${renderToStaticMarkup(<ContentSchemaRegistrySyncConflict serverVersion="5" localVersion="4" />)}</body>`,
      'text/html',
    );
    const heading = doc.querySelector('h3');
    expect(
      heading?.querySelector('[aria-hidden="true"]')?.textContent?.trim()
        .length,
    ).toBeGreaterThan(0);
    expect(heading?.textContent).toContain(
      'Review the current registry version',
    );
    expect(doc.body.textContent).toContain('Server version: 5');
    expect(doc.body.textContent).toContain('Local version: 4');
    expect(heading?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('OfflineStatus leads its heading with a decorative icon, states both versions and the retained-intent count, and offers an explicit retry', () => {
    const doc = new DOMParser().parseFromString(
      `<body>${renderToStaticMarkup(
        <ContentSchemaRegistryOfflineStatus
          connectivity="offline"
          intents={0}
          serverVersion="5"
          localVersion="4"
        />,
      )}</body>`,
      'text/html',
    );
    const heading = doc.querySelector('h3');
    expect(
      heading?.querySelector('[aria-hidden="true"]')?.textContent?.trim()
        .length,
    ).toBeGreaterThan(0);
    expect(heading?.textContent).toContain('Registry is offline');
    expect(doc.body.textContent).toContain('Server version');
    expect(doc.body.textContent).toContain('Local version');
    expect(doc.body.textContent).toContain('Retained intents');
    expect(doc.querySelector('section')?.getAttribute('role')).toBe('status');
    expect(doc.querySelector('button')?.textContent).toBe(
      'Retry canonical read',
    );
  });

  it('the conflict the DOM runtime opens on a 409 carries the same icon and both versions', () => {
    document.body.innerHTML =
      '<form id="f" action="/app/cms-content-modeling/x/versions/y"><input name="if-match" value="&quot;4&quot;"></form>';
    const form = document.querySelector('form') as HTMLFormElement;
    const conflict = renderConflict(form, { serverVersion: '5' }, window);
    const heading = conflict.querySelector('h3');
    expect(
      heading?.querySelector('[aria-hidden="true"]')?.textContent?.trim()
        .length,
    ).toBeGreaterThan(0);
    expect(conflict.textContent).toContain('Server version: 5');
    expect(conflict.textContent).toContain('Local version: 4');
    expect(
      [...conflict.querySelectorAll('button')].map(
        (button) => button.textContent,
      ),
    ).toEqual([
      'Review current version',
      'Reapply retained input',
      'Discard retained input',
    ]);
  });
});

describe('[P2-S09-AC-239] the registry table is a semantic table with labelled sort buttons', () => {
  const sortButtons = (doc: Document) => [
    ...doc.querySelectorAll<HTMLButtonElement>('thead th button'),
  ];

  it('puts a native button with an accessible name in each sortable column header and none in the others', () => {
    const doc = listDocument();
    const headers = [...doc.querySelectorAll<HTMLTableCellElement>('thead th')];
    const sortable = headers
      .filter((header) => header.querySelector('button') !== null)
      .map((header) => header.textContent?.trim());
    expect(sortable).toEqual(['Key', 'Version', 'Updated']);
    for (const button of sortButtons(doc)) {
      expect(button.type).toBe('submit');
      expect(
        (button.getAttribute('aria-label') ?? button.textContent ?? '').trim()
          .length,
      ).toBeGreaterThan(5);
    }
    expect(doc.querySelector('table caption')?.textContent).toBeTruthy();
    expect(doc.querySelectorAll('thead th[scope="col"]').length).toBe(
      headers.length,
    );
  });

  it('each sort button commits the sort and the toggled direction as URL state and keeps the other filters', () => {
    const doc = listDocument({
      ...QUERY,
      resourceKind: 'content_type',
      keyPrefix: 'rel',
    });
    const key = sortButtons(doc).find(
      (button) => button.textContent?.trim() === 'Key',
    ) as HTMLButtonElement;
    const version = sortButtons(doc).find(
      (button) => button.textContent?.trim() === 'Version',
    ) as HTMLButtonElement;
    const urlFor = (button: HTMLButtonElement) => {
      const form = button.closest('form') as HTMLFormElement;
      const data = new FormData(form);
      if (button.name !== '') data.set(button.name, button.value);
      return new URLSearchParams(data as never);
    };
    const keyParams = urlFor(key);
    expect([keyParams.get('sort'), keyParams.get('direction')]).toEqual([
      'key',
      'desc',
    ]);
    expect([
      keyParams.get('resourceKind'),
      keyParams.get('keyPrefix'),
      keyParams.get('limit'),
    ]).toEqual(['content_type', 'rel', '25']);
    expect(keyParams.has('cursor')).toBe(false);
    const versionParams = urlFor(version);
    expect([versionParams.get('sort'), versionParams.get('direction')]).toEqual(
      ['version', 'asc'],
    );
    expect(key.getAttribute('aria-label')).toMatch(/Key/u);
    expect(key.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(version.closest('th')?.getAttribute('aria-sort')).toBeNull();
  });

  it('keeps a stable key per row, a priority list for narrow screens and no bulk action to name', () => {
    const doc = listDocument();
    const keys = [...doc.querySelectorAll('[data-cms-focus-key]')].map(
      (element) => element.getAttribute('data-cms-focus-key'),
    );
    expect(
      keys.every((key) => key?.startsWith('content-schema-registry-view-')),
    ).toBe(true);
    expect(
      doc.querySelector('ol[aria-label="Registry records priority list"] li'),
    ).not.toBeNull();
    expect(doc.querySelectorAll('tbody tr').length).toBe(listPage.items.length);
    expect(
      doc.querySelectorAll('ol[aria-label="Registry records priority list"] li')
        .length,
    ).toBe(listPage.items.length);
    expect(
      doc.querySelector(
        'input[type="checkbox"][name="selection"], [data-bulk-action]',
      ),
    ).toBeNull();
  });
});
