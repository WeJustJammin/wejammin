import { describe, expect, it } from 'vitest';

import {
  detailPath,
  detailRequest,
  detailResource,
  expectError,
  governedHarness,
  jsonReply,
  OTHER_REVIEW_ID,
  queueItem,
  queuePage,
  queueRequest,
  REQUEST_ID,
  REVIEW_ID,
  reviewerSession,
} from './governed-review-ops.test-support';

const make = (
  reply: () => Promise<Response>,
  options: Parameters<typeof governedHarness>[0] = {},
) => governedHarness({ session: reviewerSession, reply, ...options });

const wireOf = (harness: ReturnType<typeof make>): Record<string, unknown> =>
  (
    JSON.parse(String(harness.fetchImpl.mock.calls[0]?.[1]?.body)) as {
      p_request: Record<string, unknown>;
    }
  ).p_request;

describe('CMS-03C-10 review detail (BE03c row 172)', () => {
  it('answers 200 with the strict detail, a strong review-version ETag and no-store', async () => {
    const detail = detailResource({ version: '5' });
    const harness = make(() => jsonReply(detail));
    const response = await harness.send(detailRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"5"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(detail);
    expect(wireOf(harness)).toEqual({
      reviewId: REVIEW_ID,
      context: expect.objectContaining({ requestId: expect.any(String) }),
      correlationId: expect.any(String),
    });
  });

  it('sends no mutation member and charges no write quota', async () => {
    const harness = make(() => jsonReply(detailResource()));
    await harness.send(detailRequest());
    const headers = new Headers(harness.fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.has('x-idempotency-key')).toBe(false);
    expect(
      harness.rateLimit.mock.calls.map(([input]) => input.rateClass),
    ).toEqual(['cms-governed-review-read', 'cms-governed-review-read']);
  });

  it('applies no Worker capability gate: scope is the database (404 vs 403)', async () => {
    const harness = make(() => jsonReply(detailResource()), {
      session: { ...reviewerSession, capabilities: [] },
    });
    expect((await harness.send(detailRequest())).status).toBe(200);
  });

  it('refuses a detail for another review as a local 502', async () => {
    const harness = make(() =>
      jsonReply(detailResource({ id: OTHER_REVIEW_ID })),
    );
    await expectError(
      await harness.send(detailRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each([
    ['a non-UUID path', detailRequest({}, detailPath('not-a-uuid'))],
    ['any query key', detailRequest({}, detailPath() + '?scope=owned')],
    [
      'an Idempotency-Key',
      detailRequest({ headers: { 'idempotency-key': 'a'.repeat(16) } }),
    ],
    ['an If-Match', detailRequest({ headers: { 'if-match': '"1"' } })],
  ])('refuses %s with 400 before any quota', async (_name, request) => {
    const harness = make(() => jsonReply(detailResource()));
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses request media on a read with 415 and the empty allowlist', async () => {
    const harness = make(() => jsonReply(detailResource()));
    const error = await expectError(
      await harness.send(
        detailRequest({ headers: { 'content-type': 'application/json' } }),
      ),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(error.details).toEqual({ allowedMediaTypes: [] });
  });

  it('keeps a read free of CSRF and answers a GET preflight', async () => {
    const harness = make(() => jsonReply(detailResource()));
    const request = detailRequest({
      headers: { cookie: 'wj_session_ref=abc' },
    });
    expect((await harness.send(request)).status).toBe(200);
    const preflight = await harness.send(
      new Request(detailPath(), {
        method: 'OPTIONS',
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
  });
});

describe('CMS-03C-11 review queue (BE03c row 173)', () => {
  it('answers the shared queue-path preflight with GET and POST and refuses a foreign origin with 403', async () => {
    const harness = make(() => jsonReply(queuePage()));
    const path = 'https://api.example.test/api/v1/cms/governed-reviews';
    const ok = await harness.send(
      new Request(path, {
        method: 'OPTIONS',
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-methods')).toBe(
      'GET, POST, OPTIONS',
    );
    expect(ok.headers.get('access-control-allow-headers')).toMatch(
      /authorization/iu,
    );
    expect(ok.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    const foreign = await harness.send(
      new Request(path, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://foreign.example.test',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectError(foreign, 403, 'GOVERNED_REVIEW_FORBIDDEN');
    const missing = await harness.send(
      new Request(path, { method: 'OPTIONS' }),
    );
    expect(missing.status).toBe(403);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('answers 200 with the strict page, the page-version ETag and the contract defaults applied', async () => {
    const page = queuePage();
    const harness = make(() => jsonReply(page));
    const response = await harness.send(queueRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"7"');
    expect(await response.json()).toEqual(page);
    expect(wireOf(harness)).toMatchObject({ scope: 'assigned', limit: 25 });
    expect('cursor' in wireOf(harness)).toBe(false);
  });

  it('forwards the allowlisted filters and the opaque cursor verbatim', async () => {
    const page = queuePage(
      [
        queueItem(1, {
          state: 'approved',
          subjectKind: 'taxonomy_version',
          assignmentEndsAt: null,
        }),
      ],
      {
        nextCursor: 'opaque.next',
      },
    );
    const harness = make(() => jsonReply(page));
    const cursor = 'A'.repeat(512);
    const response = await harness.send(
      queueRequest({
        scope: 'owned',
        state: 'approved',
        subjectKind: 'taxonomy_version',
        limit: '50',
        cursor,
      }),
    );
    expect(response.status).toBe(200);
    expect(wireOf(harness)).toMatchObject({
      scope: 'owned',
      state: 'approved',
      subjectKind: 'taxonomy_version',
      limit: 50,
      cursor,
    });
  });

  it.each([
    ['an unknown key', 'owner=me'],
    ['a duplicated key', 'scope=owned&scope=assigned'],
    ['an empty cursor', 'cursor='],
    ['an over-long cursor', `cursor=${'A'.repeat(513)}`],
    ['a non-numeric limit', 'limit=abc'],
    ['a signed limit', 'limit=-1'],
    ['a fractional limit', 'limit=2.5'],
  ])('refuses %s with 400 before any quota', async (_name, query) => {
    const harness = make(() => jsonReply(queuePage()));
    await expectError(
      await harness.send(queueRequest(query)),
      400,
      'INVALID_REQUEST',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['limit', 'limit=0'],
    ['limit', 'limit=51'],
    ['scope', 'scope=everyone'],
    ['state', 'state=pending'],
    ['subjectKind', 'subjectKind=route_version'],
  ])(
    'names /%s for an out-of-bounds value with 422 (%s)',
    async (member, query) => {
      const harness = make(() => jsonReply(queuePage()));
      const error = await expectError(
        await harness.send(queueRequest(query)),
        422,
        'GOVERNED_REVIEW_VALIDATION_FAILED',
      );
      expect(error.details).toEqual({
        violations: [
          {
            path: `/${member}`,
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(harness.rateLimit).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'more items than limit',
      queuePage([queueItem(1), queueItem(2)]),
      'limit=1',
    ],
    [
      'an item outside the state filter',
      queuePage([queueItem(1)]),
      'state=approved',
    ],
    [
      'an item outside the subjectKind filter',
      queuePage([queueItem(1)]),
      'subjectKind=pattern_version',
    ],
    [
      'an assignment end outside scope assigned',
      queuePage([queueItem(1)]),
      'scope=submitted',
    ],
    [
      'a duplicated review',
      queuePage([
        queueItem(1),
        queueItem(1, { updatedAt: '2026-10-14T00:00:01Z' }),
      ]),
      '',
    ],
  ])('refuses a page with %s as a local 502', async (_name, page, query) => {
    const harness = make(() => jsonReply(page));
    await expectError(
      await harness.send(queueRequest(query)),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('refuses a page whose cursor is empty text as a local 502', async () => {
    const harness = make(() => jsonReply({ ...queuePage(), nextCursor: '' }));
    await expectError(
      await harness.send(queueRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});
