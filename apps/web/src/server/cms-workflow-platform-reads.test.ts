import { describe, expect, it } from 'vitest';

import {
  ENTRY_ID,
  REVIEW_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  queuePageFixture,
  reviewDetailFixture,
  workflowFixture,
} from '../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';
import {
  bindingFor,
  ORIGIN,
} from './cms-workflow-platform-command.test-support';
import {
  forwardCmsWorkflowRead,
  type CmsWorkflowReadOperationId,
} from './cms-workflow-platform-reads';

interface ReadCase {
  readonly operationId: CmsWorkflowReadOperationId;
  readonly params: Readonly<{ entryId?: string; reviewId?: string }>;
  readonly path: string;
  readonly upstreamPath: string;
  readonly resource: unknown;
  readonly etag: string;
  readonly mismatched: unknown;
}

const CASES: readonly ReadCase[] = [
  {
    operationId: 'CMS-03B-15',
    params: { entryId: ENTRY_ID },
    path: `/api/v1/cms/entries/${ENTRY_ID}/workflow`,
    upstreamPath: `/api/v1/cms/entries/${ENTRY_ID}/workflow`,
    resource: workflowFixture(),
    etag: '"7:4:abc"',
    mismatched: workflowFixture({
      entry: {
        id: SCHEMA_VERSION_ID,
        version: '7',
        createdAt: '2026-10-08T12:00:00Z',
        updatedAt: '2026-10-08T12:00:00Z',
      },
    }),
  },
  {
    operationId: 'CMS-03B-16',
    params: { reviewId: REVIEW_ID },
    path: `/api/v1/cms/reviews/${REVIEW_ID}`,
    upstreamPath: `/api/v1/cms/reviews/${REVIEW_ID}`,
    resource: reviewDetailFixture(),
    etag: '"2"',
    mismatched: reviewDetailFixture({ id: SCHEMA_VERSION_ID }),
  },
  {
    operationId: 'CMS-03B-17',
    params: {},
    path: '/api/v1/cms/reviews',
    upstreamPath: '/api/v1/cms/reviews',
    resource: queuePageFixture(),
    etag: '"5"',
    mismatched: queuePageFixture(),
  },
];

const get = (testCase: ReadCase, query = '', headers: HeadersInit = {}) =>
  new Request(`${ORIGIN}${testCase.path}${query}`, {
    method: 'GET',
    headers: { cookie: 'wj_access=a; wj_csrf=x', ...headers },
  });

const ok = (testCase: ReadCase, etag = testCase.etag) =>
  jsonResponse(200, testCase.resource, { etag, 'cache-control': 'no-store' });

const run = (testCase: ReadCase, request: Request, binding: unknown) =>
  forwardCmsWorkflowRead(
    testCase.operationId,
    request,
    testCase.params,
    binding,
  );

describe.each(CASES)('$operationId read proxy', (testCase) => {
  it('answers 503 without a binding or for a non-GET method', async () => {
    expect((await run(testCase, get(testCase), null)).status).toBe(503);
    const post = new Request(`${ORIGIN}${testCase.path}`, { method: 'POST' });
    expect((await run(testCase, post, bindingFor())).status).toBe(503);
  });

  it('refuses a mutation header, a media type or a body on a safe read', async () => {
    const binding = bindingFor();
    for (const headers of [
      { 'idempotency-key': 'idem-key-000000000001' },
      { 'if-match': '"1"' },
    ])
      expect(
        (await run(testCase, get(testCase, '', headers), binding)).status,
      ).toBe(400);
    expect(
      (
        await run(
          testCase,
          get(testCase, '', { 'content-type': 'application/json' }),
          binding,
        )
      ).status,
    ).toBe(415);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('relays a strict, bound, validator-carrying 200 as no-store', async () => {
    const binding = bindingFor(ok(testCase));
    const response = await run(testCase, get(testCase), binding);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(testCase.etag);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(
      JSON.parse(JSON.stringify(testCase.resource)),
    );
    const [upstream] = binding.requests();
    expect(upstream?.method).toBe('GET');
    expect(new URL(upstream?.url ?? '').pathname).toBe(testCase.upstreamPath);
    expect(upstream?.headers.get('cookie')).toContain('wj_access=a');
    expect(upstream?.headers.has('idempotency-key')).toBe(false);
  });

  it('answers 502 for a 200 that is not the strict resource or has no usable validator', async () => {
    for (const upstream of [
      jsonResponse(200, { items: 'x' }, { etag: testCase.etag }),
      new Response('not json', {
        status: 200,
        headers: { etag: testCase.etag },
      }),
      jsonResponse(200, testCase.resource),
      ok(testCase, 'W/"weak"'),
    ])
      expect(
        (await run(testCase, get(testCase), bindingFor(upstream))).status,
      ).toBe(502);
  });

  it('relays a declared error through the allowlist and refuses an undeclared pair', async () => {
    for (const [status, code] of [
      [401, 'UNAUTHENTICATED'],
      [429, 'RATE_LIMITED'],
      [503, 'DEPENDENCY_UNAVAILABLE'],
    ] as const) {
      const response = await run(
        testCase,
        get(testCase),
        bindingFor(jsonResponse(status, apiError(code))),
      );
      expect(response.status).toBe(status);
      expect(((await response.json()) as { code: string }).code).toBe(code);
    }
    expect(
      (
        await run(
          testCase,
          get(testCase),
          bindingFor(jsonResponse(418, apiError('TEAPOT'))),
        )
      ).status,
    ).toBe(502);
  });

  it('answers 503 when the binding throws or answers something that is not a Response', async () => {
    expect(
      (await run(testCase, get(testCase), bindingFor(new Error('down'))))
        .status,
    ).toBe(503);
    expect(
      (
        await run(testCase, get(testCase), {
          fetch: () => Promise.resolve(undefined),
        })
      ).status,
    ).toBe(503);
  });
});

describe('CMS-03B-15 workflow read', () => {
  const testCase = CASES[0] as ReadCase;

  it('forwards the optional revisionId and binds the answer to it', async () => {
    const binding = bindingFor(
      jsonResponse(200, approvedWorkflowFixture(), { etag: '"9"' }),
    );
    const response = await run(
      testCase,
      get(testCase, `?revisionId=${REVISION_ID}`),
      binding,
    );
    expect(response.status).toBe(200);
    expect(new URL(binding.requests()[0]?.url ?? '').search).toBe(
      `?revisionId=${REVISION_ID}`,
    );
    const other = await run(
      testCase,
      get(testCase, `?revisionId=${SCHEMA_VERSION_ID}`),
      bindingFor(jsonResponse(200, approvedWorkflowFixture(), { etag: '"9"' })),
    );
    expect(other.status).toBe(502);
  });

  it('treats an empty revisionId as absent and refuses duplicate or unknown keys', async () => {
    const binding = bindingFor(ok(testCase));
    await run(testCase, get(testCase, '?revisionId='), binding);
    expect(new URL(binding.requests()[0]?.url ?? '').search).toBe('');
    for (const query of [
      `?revisionId=${REVISION_ID}&revisionId=${REVISION_ID}`,
      '?revisionId=nope',
      '?locale=en',
    ])
      expect(
        (await run(testCase, get(testCase, query), bindingFor())).status,
      ).toBe(400);
  });

  it('rejects a malformed entry id as 400 and concealment-bound answers for another entry', async () => {
    const response = await forwardCmsWorkflowRead(
      'CMS-03B-15',
      get(testCase),
      { entryId: 'nope' },
      bindingFor(),
    );
    expect(response.status).toBe(400);
    const swapped = await run(
      testCase,
      get(testCase),
      bindingFor(
        jsonResponse(200, testCase.mismatched, { etag: testCase.etag }),
      ),
    );
    expect(swapped.status).toBe(502);
  });
});

describe('CMS-03B-16 review detail read', () => {
  const testCase = CASES[1] as ReadCase;

  it('accepts no query member and binds the answer to the review id', async () => {
    expect(
      (await run(testCase, get(testCase, '?x=1'), bindingFor())).status,
    ).toBe(400);
    expect(
      (
        await forwardCmsWorkflowRead(
          'CMS-03B-16',
          get(testCase),
          { reviewId: 'nope' },
          bindingFor(),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await run(
          testCase,
          get(testCase),
          bindingFor(jsonResponse(200, testCase.mismatched, { etag: '"2"' })),
        )
      ).status,
    ).toBe(502);
    expect(
      (
        await run(
          testCase,
          get(testCase),
          bindingFor(jsonResponse(200, testCase.resource, { etag: '"9"' })),
        )
      ).status,
    ).toBe(502);
  });
});

describe('CMS-03B-17 reviewer queue read', () => {
  const testCase = CASES[2] as ReadCase;

  it('forwards the allowlisted scope, state, limit and cursor only', async () => {
    const binding = bindingFor(ok(testCase));
    const response = await run(
      testCase,
      get(testCase, '?scope=submitted&state=open&limit=10&cursor=abc'),
      binding,
    );
    expect(response.status).toBe(200);
    const search = new URL(binding.requests()[0]?.url ?? '').searchParams;
    expect(Object.fromEntries(search)).toEqual({
      scope: 'submitted',
      state: 'open',
      limit: '10',
      cursor: 'abc',
    });
  });

  it('drops an empty state, and refuses duplicate, unknown or out-of-range members', async () => {
    const binding = bindingFor(ok(testCase));
    await run(testCase, get(testCase, '?state=&scope=assigned'), binding);
    expect(new URL(binding.requests()[0]?.url ?? '').search).toBe(
      '?scope=assigned',
    );
    for (const query of [
      '?scope=assigned&scope=assigned',
      '?scope=everyone',
      '?state=bogus',
      '?limit=0',
      '?limit=51',
      '?limit=abc',
      '?cursor=',
      `?cursor=${'x'.repeat(513)}`,
      '?person=1',
    ])
      expect(
        (await run(testCase, get(testCase, query), bindingFor())).status,
      ).toBe(400);
  });

  it('relays the cursor conflict so the page restarts from the first page', async () => {
    const response = await run(
      testCase,
      get(testCase, '?cursor=abc'),
      bindingFor(jsonResponse(409, apiError('CONFLICT'))),
    );
    expect(response.status).toBe(409);
  });
});
