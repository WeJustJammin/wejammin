import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import {
  CSRF,
  HASH_A,
  KEY,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  SUBJECT_ID,
  governedActivationFixture,
  governedAssignmentFixture,
  governedDetailFixture,
  governedQueuePageFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../../../../server/cms-governed-review-fixtures.test-support';
import { ORIGIN } from '../../../../../server/cms-workflow-platform-command.test-support';

/*
 * Each governed-review browser operation has exactly one Astro endpoint at the
 * path BE03c declares, exporting only its methods and never prerendered. The
 * handler forwards through the private binding to the SAME path; the transport
 * rules are covered by the proxy suites.
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
  ['./index.ts', './[[]reviewId[]].ts', './[[]reviewId[]]/*.ts'],
  { eager: true },
);

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const moduleAt = (file: string): RouteModule =>
  MODULES[file] as unknown as RouteModule;

const post = (path: string, body: unknown, ifMatch?: string): Request =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      cookie: `wj_access=a; wj_csrf=${CSRF}`,
      origin: ORIGIN,
      'x-csrf-token': CSRF,
      'idempotency-key': KEY,
      'content-type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    },
    body: JSON.stringify(body),
  });

const get = (path: string): Request =>
  new Request(`${ORIGIN}${path}`, {
    headers: { cookie: 'wj_access=a' },
  });

const forwardedPath = (): string =>
  new URL((fetchMock.mock.calls[0]?.[0] as Request).url).pathname;

describe('governed-review first-party endpoints', () => {
  it('has exactly five endpoint modules, none prerendered', () => {
    expect(Object.keys(MODULES).sort()).toEqual([
      './[reviewId].ts',
      './[reviewId]/activation.ts',
      './[reviewId]/assignments.ts',
      './[reviewId]/decision.ts',
      './index.ts',
    ]);
    for (const file of Object.keys(MODULES))
      expect(moduleAt(file).prerender, file).toBe(false);
  });

  it('exports only the methods each registry row declares', () => {
    const exported = (file: string) =>
      METHODS.filter((method) => moduleAt(file)[method] !== undefined);
    expect(exported('./index.ts')).toEqual(['GET', 'POST']);
    expect(exported('./[reviewId].ts')).toEqual(['GET']);
    expect(exported('./[reviewId]/decision.ts')).toEqual(['POST']);
    expect(exported('./[reviewId]/assignments.ts')).toEqual(['POST']);
    expect(exported('./[reviewId]/activation.ts')).toEqual(['POST']);
  });

  it('CMS-03C-11 forwards the queue read to the registry path', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, governedQueuePageFixture(), { etag: '"5"' }),
    );
    const response = await (moduleAt('./index.ts').GET as Handler)({
      request: get('/api/v1/cms/governed-reviews'),
    } as never);
    expect(response.status).toBe(200);
    expect(forwardedPath()).toBe('/api/v1/cms/governed-reviews');
  });

  it('CMS-03C-06 forwards the submission to the registry path', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
    );
    const response = await (moduleAt('./index.ts').POST as Handler)({
      request: post('/api/v1/cms/governed-reviews', {
        subjectKind: 'template_version',
        subjectId: SUBJECT_ID,
        subjectHash: HASH_A,
      }),
    } as never);
    expect(response.status).toBe(201);
    expect(forwardedPath()).toBe('/api/v1/cms/governed-reviews');
  });

  it('CMS-03C-10 binds the review id from the route', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, governedDetailFixture(), { etag: '"2"' }),
    );
    const response = await (moduleAt('./[reviewId].ts').GET as Handler)({
      request: get(`/api/v1/cms/governed-reviews/${REVIEW_ID}`),
      params: { reviewId: REVIEW_ID },
    } as never);
    expect(response.status).toBe(200);
    expect(forwardedPath()).toBe(`/api/v1/cms/governed-reviews/${REVIEW_ID}`);
  });

  it('CMS-03C-07 binds the review id from the route', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        governedReviewFixture({
          version: '3',
          state: 'approved',
          recordedDecisionCount: 1,
          decidedAt: LATER,
        }),
        { etag: '"3"' },
      ),
    );
    const path = `/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`;
    const response = await (
      moduleAt('./[reviewId]/decision.ts').POST as Handler
    )({
      request: post(
        path,
        {
          reviewId: REVIEW_ID,
          decision: 'approve',
          reason: 'Matches the frozen dependencies.',
          expectedVersion: '2',
        },
        '"2"',
      ),
      params: { reviewId: REVIEW_ID },
    } as never);
    expect(response.status).toBe(200);
    expect(forwardedPath()).toBe(path);
  });

  it('CMS-03C-08 binds the review id from the route', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' }),
    );
    const path = `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`;
    const response = await (
      moduleAt('./[reviewId]/assignments.ts').POST as Handler
    )({
      request: post(
        path,
        {
          action: 'create',
          expectedVersion: '2',
          reviewerPersonId: REVIEWER_PERSON_ID,
          expiresAt: LATER,
        },
        '"2"',
      ),
      params: { reviewId: REVIEW_ID },
    } as never);
    expect(response.status).toBe(201);
    expect(forwardedPath()).toBe(path);
  });

  it('CMS-03C-09 binds the review id from the route', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, governedActivationFixture(), {
        etag: '"3"',
        location: `/api/v1/cms/governed-reviews/${REVIEW_ID}`,
      }),
    );
    const path = `/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`;
    const response = await (
      moduleAt('./[reviewId]/activation.ts').POST as Handler
    )({
      request: post(path, { action: 'activate', expectedVersion: '2' }, '"2"'),
      params: { reviewId: REVIEW_ID },
    } as never);
    expect(response.status).toBe(200);
    expect(forwardedPath()).toBe(path);
  });
});
