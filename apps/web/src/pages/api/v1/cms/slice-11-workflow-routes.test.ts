import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  ENTRY_ID,
  REVIEW_ID,
  jsonResponse,
  apiError,
} from '../../../../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';
import {
  COMMAND_CASES,
  commandRequest,
  upstreamSuccess,
} from '../../../../server/cms-workflow-platform-command.test-support';

/*
 * Each Slice 11 browser operation has exactly one Astro endpoint, at the path
 * the generated registry declares, exporting only the registry method and never
 * prerendered. The handler forwards through the private binding to the SAME
 * path; the transport rules themselves are covered by the proxy suites.
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
    './entries/[[]entryId[]]/reviews.ts',
    './entries/[[]entryId[]]/workflow.ts',
    './reviews/index.ts',
    './reviews/[[]reviewId[]].ts',
    './reviews/[[]reviewId[]]/decision.ts',
    './reviews/[[]reviewId[]]/assignments.ts',
    './publication-schedules/index.ts',
    './previews/index.ts',
    './publications/index.ts',
  ],
  { eager: true },
);

const BROWSER_OPERATIONS = [
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const;

/** `/api/v1/cms/reviews/{reviewId}` -> `./reviews/[reviewId].ts` or `.../index.ts`. */
const candidateFiles = (path: string): string[] => {
  const relative = path
    .replace('/api/v1/cms/', '')
    .replaceAll('{', '[')
    .replaceAll('}', ']');
  return [`./${relative}.ts`, `./${relative}/index.ts`];
};

const rowOf = (operationId: (typeof BROWSER_OPERATIONS)[number]) =>
  cmsEditorialRoutePolicies.find((row) => row.operationId === operationId)!;

const moduleFor = (operationId: (typeof BROWSER_OPERATIONS)[number]) => {
  const row = rowOf(operationId);
  const key = candidateFiles(row.path).find((file) => file in MODULES);
  return { row, module: key === undefined ? undefined : MODULES[key] };
};

describe('Slice 11 first-party endpoints match the generated registry', () => {
  it('has exactly nine endpoint modules', () => {
    expect(Object.keys(MODULES)).toHaveLength(9);
  });

  it.each(BROWSER_OPERATIONS)(
    '%s has one endpoint at its registry path exporting only its method',
    (operationId) => {
      const { row, module } = moduleFor(operationId);
      expect(module, `${operationId} ${row.path}`).toBeDefined();
      expect(module?.prerender).toBe(false);
      const exported = (
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
      ).filter((method) => module?.[method] !== undefined);
      expect(exported).toEqual([row.method]);
    },
  );

  it.each(BROWSER_OPERATIONS.filter((id) => rowOf(id).method === 'POST'))(
    '%s forwards a verified command to its registry path through the private binding',
    async (operationId) => {
      const { row, module } = moduleFor(operationId);
      const testCase = COMMAND_CASES[operationId as keyof typeof COMMAND_CASES];
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(upstreamSuccess(testCase));
      const response = await (module?.POST as Handler)({
        request: commandRequest(testCase),
        params: testCase.params,
      } as never);
      expect(response.status).toBe(testCase.successStatus);
      const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
      expect(forwarded.method).toBe('POST');
      expect(new URL(forwarded.url).pathname).toBe(
        row.path
          .replace('{entryId}', testCase.params.entryId ?? '')
          .replace('{reviewId}', testCase.params.reviewId ?? ''),
      );
    },
  );

  it.each(BROWSER_OPERATIONS.filter((id) => rowOf(id).method === 'GET'))(
    '%s forwards a read to its registry path with no body',
    async (operationId) => {
      const { row, module } = moduleFor(operationId);
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, apiError('UNAUTHENTICATED')),
      );
      const params = { entryId: ENTRY_ID, reviewId: REVIEW_ID };
      const response = await (module?.GET as Handler)({
        request: new Request(
          `https://app.example.test${row.path
            .replace('{entryId}', ENTRY_ID)
            .replace('{reviewId}', REVIEW_ID)}`,
          { method: 'GET', headers: { cookie: 'wj_access=a' } },
        ),
        params,
      } as never);
      expect(response.status).toBe(401);
      const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
      expect(forwarded.method).toBe('GET');
      expect(forwarded.body).toBeNull();
      expect(new URL(forwarded.url).pathname).toBe(
        row.path
          .replace('{entryId}', ENTRY_ID)
          .replace('{reviewId}', REVIEW_ID),
      );
    },
  );
});
