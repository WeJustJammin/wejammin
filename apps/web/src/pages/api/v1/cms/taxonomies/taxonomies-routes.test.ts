import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  SELECTOR_PATH,
  TAXONOMY_ID,
  TERMS_PATH,
  VERSIONS_PATH,
  actionRequest,
  jsonResponse,
  readRequest,
  selectorPageFixture,
  termResourceFixture,
  termsPageFixture,
  versionFixture,
  versionsPageFixture,
  writeRequest,
} from '../../../../../server/cms-taxonomy-platform.test-support';

/*
 * Each vocabulary browser operation has exactly one Astro endpoint at the path BE03c
 * declares, exporting only its method and never prerendered. The handler forwards
 * through the private binding to the SAME path; the transport rules are covered by the
 * proxy suites.
 */
type Handler = (context: never) => Response | Promise<Response>;
interface RouteModule {
  readonly prerender?: boolean;
  readonly GET?: Handler;
  readonly POST?: Handler;
  readonly PUT?: Handler;
  readonly PATCH?: Handler;
  readonly DELETE?: Handler;
}

const MODULES = import.meta.glob<RouteModule>(
  [
    './versions.ts',
    './selector.ts',
    './[[]taxonomyId[]]/versions.ts',
    './[[]taxonomyId[]]/terms.ts',
    './[[]taxonomyId[]]/terms/actions.ts',
  ],
  { eager: true },
);
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const moduleAt = (file: string): RouteModule =>
  MODULES[file] as unknown as RouteModule;
const call = (handler: Handler | undefined, context: unknown) =>
  (handler as unknown as (context: unknown) => Promise<Response>)(context);

const ROUTES: ReadonlyArray<readonly [string, 'GET' | 'POST', string, string]> =
  [
    ['./versions.ts', 'POST', '/api/v1/cms/taxonomies/versions', 'CMS-03C-16'],
    ['./selector.ts', 'GET', '/api/v1/cms/taxonomies/selector', 'CMS-03C-17'],
    [
      './[taxonomyId]/versions.ts',
      'GET',
      `/api/v1/cms/taxonomies/${TAXONOMY_ID}/versions`,
      'cmsTaxonomyVersionsRead',
    ],
    [
      './[taxonomyId]/terms.ts',
      'GET',
      `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms`,
      'cmsTaxonomyTermsRead',
    ],
    [
      './[taxonomyId]/terms/actions.ts',
      'POST',
      `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`,
      'CMS-03C-03',
    ],
  ];

describe('vocabulary routes sit at the BE03c registry paths', () => {
  it('has exactly the five routes', () => {
    expect(Object.keys(MODULES).sort()).toEqual(
      ROUTES.map(([file]) => file).sort(),
    );
  });

  it.each(ROUTES)('%s is dynamic and exports only %s', (file, method) => {
    const route = moduleAt(file);
    expect(route.prerender).toBe(false);
    expect(METHODS.filter((name) => route[name] !== undefined)).toEqual([
      method,
    ]);
  });
});

describe('vocabulary routes forward through the private binding to the same path', () => {
  const cases: ReadonlyArray<
    readonly [string, Request, Record<string, string>, Response, string]
  > = [
    [
      './versions.ts',
      writeRequest(),
      {},
      jsonResponse(201, versionFixture(), { etag: '"1"' }),
      '/api/v1/cms/taxonomies/versions',
    ],
    [
      './selector.ts',
      readRequest(
        SELECTOR_PATH,
        {},
        '?typeKey=article&fieldKey=tags&locale=en',
      ),
      {},
      jsonResponse(200, selectorPageFixture(), { etag: '"7"' }),
      '/api/v1/cms/taxonomies/selector?typeKey=article&fieldKey=tags&locale=en',
    ],
    [
      './[taxonomyId]/versions.ts',
      readRequest(VERSIONS_PATH),
      { taxonomyId: TAXONOMY_ID },
      jsonResponse(200, versionsPageFixture(), { etag: '"3"' }),
      VERSIONS_PATH,
    ],
    [
      './[taxonomyId]/terms.ts',
      readRequest(TERMS_PATH),
      { taxonomyId: TAXONOMY_ID },
      jsonResponse(200, termsPageFixture(), { etag: '"7"' }),
      TERMS_PATH,
    ],
    [
      './[taxonomyId]/terms/actions.ts',
      actionRequest(),
      { taxonomyId: TAXONOMY_ID },
      jsonResponse(200, termResourceFixture(), { etag: '"1"' }),
      `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`,
    ],
  ];

  it.each(cases)('%s', async (file, request, params, upstream, target) => {
    const route = moduleAt(file);
    fetchMock.mockResolvedValueOnce(upstream);
    const handler = route.GET ?? route.POST;
    const response = await call(handler, { request, params });
    expect(response.status).toBeLessThan(300);
    const sent = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(sent.url).toBe(`https://platform-api.internal${target}`);
  });

  it('rejects non-JSON before using the binding', async () => {
    fetchMock.mockClear();
    const response = await call(moduleAt('./versions.ts').POST, {
      request: writeRequest({ headers: { 'content-type': 'text/plain' } }),
      params: {},
    });
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a malformed vocabulary id with a 400 and never reaches the binding', async () => {
    fetchMock.mockClear();
    for (const file of [
      './[taxonomyId]/versions.ts',
      './[taxonomyId]/terms.ts',
    ]) {
      const route = moduleAt(file);
      const response = await call(route.GET, {
        request: readRequest(VERSIONS_PATH),
        params: { taxonomyId: 'new' },
      });
      expect(response.status).toBe(400);
    }
    const action = await call(
      moduleAt('./[taxonomyId]/terms/actions.ts').POST,
      { request: actionRequest(), params: { taxonomyId: 'new' } },
    );
    expect(action.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
