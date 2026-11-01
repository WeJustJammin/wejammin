import { cmsCompositionCatalogMessage } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  REVIEW_ID,
  SUBJECT_ID,
  governedApiError,
  governedDetailFixture,
  governedQueueItem,
  governedQueuePageFixture,
  jsonResponse,
} from './cms-governed-review-fixtures.test-support';
import {
  forwardCmsGovernedReviewRead,
  type CmsGovernedReadOperationId,
} from './cms-governed-review-platform-reads';
import {
  bindingFor,
  ORIGIN,
} from './cms-workflow-platform-command.test-support';

const COOKIE = 'wj_access=a; wj_csrf=csrf-token-000000000001';

const get = (
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Request =>
  new Request(`${ORIGIN}${path}`, {
    method: 'GET',
    headers: { cookie: COOKIE, ...headers },
  });

const detailPath = `/api/v1/cms/governed-reviews/${REVIEW_ID}`;
const queuePath = '/api/v1/cms/governed-reviews';

const detail = (
  operationId: CmsGovernedReadOperationId = 'CMS-03C-10',
  request = get(detailPath),
  binding: unknown = bindingFor(),
) =>
  forwardCmsGovernedReviewRead(
    operationId,
    request,
    { reviewId: REVIEW_ID },
    binding,
  );

const queue = (query: string, binding: unknown = bindingFor()) =>
  forwardCmsGovernedReviewRead(
    'CMS-03C-11',
    get(`${queuePath}${query}`),
    {},
    binding,
  );

const okDetail = (overrides: Record<string, unknown> = {}, etag = '"2"') =>
  jsonResponse(200, governedDetailFixture(overrides), { etag });

const okPage = (
  items = [governedQueueItem(1)],
  etag = '"5"',
  nextCursor: string | null = null,
) => jsonResponse(200, governedQueuePageFixture(items, nextCursor), { etag });

describe('CMS-03C-10 governed review detail proxy', () => {
  it('relays a strict, bound, validator-carrying 200 as no-store', async () => {
    const binding = bindingFor(okDetail());
    const response = await detail('CMS-03C-10', get(detailPath), binding);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(
      JSON.parse(JSON.stringify(governedDetailFixture())),
    );
    const [upstream] = binding.requests();
    expect(upstream?.method).toBe('GET');
    expect(new URL(upstream?.url ?? '').pathname).toBe(detailPath);
    expect(new URL(upstream?.url ?? '').search).toBe('');
    expect(upstream?.headers.get('cookie')).toContain('wj_access=a');
    for (const name of ['idempotency-key', 'if-match', 'x-csrf-token'])
      expect(upstream?.headers.has(name)).toBe(false);
  });

  it('answers 503 without a binding or for a non-GET method', async () => {
    expect((await detail('CMS-03C-10', get(detailPath), null)).status).toBe(
      503,
    );
    const post = new Request(`${ORIGIN}${detailPath}`, { method: 'POST' });
    expect((await detail('CMS-03C-10', post)).status).toBe(503);
  });

  it('refuses a malformed review id, any query key, a mutation header, a media type or a body before any upstream call', async () => {
    const binding = bindingFor();
    const malformed = await forwardCmsGovernedReviewRead(
      'CMS-03C-10',
      get('/api/v1/cms/governed-reviews/not-a-uuid'),
      { reviewId: 'not-a-uuid' },
      binding,
    );
    expect(malformed.status).toBe(400);
    expect(
      (await detail('CMS-03C-10', get(`${detailPath}?debug=1`), binding))
        .status,
    ).toBe(400);
    for (const headers of [
      { 'idempotency-key': 'idem-key-000000000001' },
      { 'if-match': '"1"' },
    ])
      expect(
        (await detail('CMS-03C-10', get(detailPath, headers), binding)).status,
      ).toBe(400);
    expect(
      (
        await detail(
          'CMS-03C-10',
          get(detailPath, { 'content-type': 'application/json' }),
          binding,
        )
      ).status,
    ).toBe(415);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['a body that names another review', okDetail({ id: SUBJECT_ID })],
    [
      'a body with an identifier beyond the contract',
      jsonResponse(
        200,
        { ...governedDetailFixture(), reviewerPersonId: SUBJECT_ID },
        { etag: '"2"' },
      ),
    ],
    ['a missing validator', jsonResponse(200, governedDetailFixture())],
    ['a weak validator', okDetail({}, 'W/"2"')],
    ['a validator that is not the review version', okDetail({}, '"9"')],
    ['a body that is not JSON', new Response('nope', { status: 200 })],
  ] as const)('answers 502 for %s', async (_name, upstream) => {
    const response = await detail(
      'CMS-03C-10',
      get(detailPath),
      bindingFor(upstream),
    );
    expect(response.status).toBe(502);
  });

  it('answers 503 when the binding throws', async () => {
    const response = await detail(
      'CMS-03C-10',
      get(detailPath),
      bindingFor(new Error('boom')),
    );
    expect(response.status).toBe(503);
  });

  it('relays the catalog 404 identically for a hidden, absent or cross-owner review', async () => {
    const message = cmsCompositionCatalogMessage(
      'governedReview',
      'GOVERNED_REVIEW_NOT_FOUND',
    );
    const response = await detail(
      'CMS-03C-10',
      get(detailPath),
      bindingFor(
        jsonResponse(
          404,
          governedApiError('GOVERNED_REVIEW_NOT_FOUND', message, { id: 'x' }),
        ),
      ),
    );
    expect(response.status).toBe(404);
    expect(((await response.json()) as { details: unknown }).details).toEqual(
      {},
    );
  });

  it('relays capability_missing as a 403 reason and refuses an undeclared 409', async () => {
    const forbidden = await detail(
      'CMS-03C-10',
      get(detailPath),
      bindingFor(
        jsonResponse(
          403,
          governedApiError(
            'GOVERNED_REVIEW_FORBIDDEN',
            cmsCompositionCatalogMessage(
              'governedReview',
              'GOVERNED_REVIEW_FORBIDDEN',
            ),
            { reasonCode: 'capability_missing' },
          ),
        ),
      ),
    );
    expect(forbidden.status).toBe(403);
    expect(((await forbidden.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'capability_missing',
    });
    const conflict = await detail(
      'CMS-03C-10',
      get(detailPath),
      bindingFor(
        jsonResponse(
          409,
          governedApiError(
            'GOVERNED_REVIEW_VERSION_CONFLICT',
            cmsCompositionCatalogMessage(
              'governedReview',
              'GOVERNED_REVIEW_VERSION_CONFLICT',
            ),
          ),
        ),
      ),
    );
    expect(conflict.status).toBe(502);
  });
});

describe('CMS-03C-11 governed review queue proxy', () => {
  it('forwards the default query and relays a strict page keyed by its page version', async () => {
    const binding = bindingFor(okPage());
    const response = await queue('', binding);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"5"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      ((await response.json()) as { pageVersion: string }).pageVersion,
    ).toBe('5');
    const [upstream] = binding.requests();
    expect(new URL(upstream?.url ?? '').pathname).toBe(queuePath);
    expect(new URL(upstream?.url ?? '').search).toBe('');
  });

  it('forwards the allowlisted members in request order', async () => {
    const binding = bindingFor(
      okPage([
        governedQueueItem(1, { state: 'approved', assignmentEndsAt: null }),
      ]),
    );
    const response = await queue(
      '?scope=owned&state=approved&subjectKind=template_version&limit=10&cursor=abc',
      binding,
    );
    expect(response.status).toBe(200);
    const [upstream] = binding.requests();
    expect(new URL(upstream?.url ?? '').search).toBe(
      '?scope=owned&state=approved&subjectKind=template_version&limit=10&cursor=abc',
    );
  });

  it('treats an empty optional filter of a native GET form as absence', async () => {
    const binding = bindingFor(okPage());
    const response = await queue(
      '?scope=assigned&state=&subjectKind=',
      binding,
    );
    expect(response.status).toBe(200);
    const [upstream] = binding.requests();
    expect(new URL(upstream?.url ?? '').search).toBe('?scope=assigned');
  });

  it.each([
    ['an unknown member', '?debug=1'],
    ['a duplicated member', '?scope=owned&scope=owned'],
    ['an empty cursor', '?cursor='],
    ['an oversize cursor', `?cursor=${'a'.repeat(513)}`],
    ['a non-numeric limit', '?limit=ten'],
    ['a limit with a sign', '?limit=%2B5'],
  ] as const)(
    'answers 400 for %s without an upstream call',
    async (_name, query) => {
      const binding = bindingFor();
      expect((await queue(query, binding)).status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['limit 0', '?limit=0', '/limit'],
    ['limit 51', '?limit=51', '/limit'],
    ['an unknown scope', '?scope=everyone', '/scope'],
    ['an unknown state', '?state=pending', '/state'],
    ['an unknown subject kind', '?subjectKind=block', '/subjectKind'],
  ] as const)(
    'answers 422 at the member for %s',
    async (_name, query, path) => {
      const binding = bindingFor();
      const response = await queue(query, binding);
      expect(response.status).toBe(422);
      expect(
        (
          (await response.json()) as {
            details: { violations: { path: string }[] };
          }
        ).details.violations[0]?.path,
      ).toBe(path);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'a page larger than the limit',
      '?limit=1',
      okPage([governedQueueItem(1), governedQueueItem(2)]),
    ],
    [
      'a row outside the state filter',
      '?state=approved',
      okPage([governedQueueItem(1)]),
    ],
    [
      'a row outside the subject kind filter',
      '?subjectKind=pattern_version',
      okPage([governedQueueItem(1)]),
    ],
    [
      'an assignment end outside the assigned scope',
      '?scope=owned',
      okPage([governedQueueItem(1)]),
    ],
    ['a validator that is not the page version', '', okPage([], '"9"')],
    ['a missing validator', '', jsonResponse(200, governedQueuePageFixture())],
    [
      'a duplicate row',
      '',
      jsonResponse(
        200,
        {
          items: [governedQueueItem(1), governedQueueItem(1)],
          nextCursor: null,
          pageVersion: '5',
        },
        { etag: '"5"' },
      ),
    ],
  ] as const)('answers 502 for %s', async (_name, query, upstream) => {
    expect((await queue(query, bindingFor(upstream))).status).toBe(502);
  });

  it('relays a 409 cursor conflict from the catalog', async () => {
    const response = await queue(
      '?cursor=abc',
      bindingFor(
        jsonResponse(
          409,
          governedApiError(
            'GOVERNED_REVIEW_VERSION_CONFLICT',
            cmsCompositionCatalogMessage(
              'governedReview',
              'GOVERNED_REVIEW_VERSION_CONFLICT',
            ),
          ),
        ),
      ),
    );
    expect(response.status).toBe(409);
  });

  it('relays the signed continuation cursor untouched', async () => {
    const binding = bindingFor(okPage([governedQueueItem(1)], '"5"', 'next'));
    const response = await queue('', binding);
    expect(((await response.json()) as { nextCursor: string }).nextCursor).toBe(
      'next',
    );
  });
});
