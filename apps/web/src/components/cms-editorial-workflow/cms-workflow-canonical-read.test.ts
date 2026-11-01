// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  REVIEW_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import {
  readCanonicalReview,
  readCanonicalWorkflow,
} from './cms-workflow-canonical-read';

const answer = (response: Response | Error) =>
  vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );

describe('readCanonicalWorkflow', () => {
  it('reads the workflow no-store from the first-party path and returns the strict resource', async () => {
    const resource = workflowFixture();
    const fetcher = answer(jsonResponse(200, resource, { etag: '"7:4"' }));
    const result = await readCanonicalWorkflow(ENTRY_ID, null, fetcher);
    expect(result).toEqual({ kind: 'ok', resource });
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`/api/v1/cms/entries/${ENTRY_ID}/workflow`);
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('accept')).toBe('application/json');
  });

  it('carries the revision id and binds the answer to it', async () => {
    const resource = workflowFixture();
    const fetcher = answer(jsonResponse(200, resource, { etag: '"x"' }));
    expect(
      (await readCanonicalWorkflow(ENTRY_ID, REVISION_ID, fetcher)).kind,
    ).toBe('ok');
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/workflow?revisionId=${REVISION_ID}`,
    );
    expect(
      (
        await readCanonicalWorkflow(
          ENTRY_ID,
          SCHEMA_VERSION_ID,
          answer(jsonResponse(200, resource, { etag: '"x"' })),
        )
      ).kind,
    ).toBe('degraded');
  });

  it('degrades on an unverifiable 200, a transport loss or a 5xx and keeps the request id', async () => {
    for (const response of [
      jsonResponse(200, { entry: 1 }, { etag: '"x"' }),
      new Response('nope', { status: 200 }),
      jsonResponse(200, workflowFixture()),
      new Error('offline'),
    ])
      expect(
        await readCanonicalWorkflow(ENTRY_ID, null, answer(response)),
      ).toEqual({
        kind: 'degraded',
        requestId: null,
      });
    expect(
      await readCanonicalWorkflow(
        ENTRY_ID,
        null,
        answer(jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'))),
      ),
    ).toEqual({
      kind: 'degraded',
      requestId: '0195b6f0-0000-7000-8000-000000000001',
    });
  });

  it('classifies a signed-out session and a concealed or denied record', async () => {
    expect(
      await readCanonicalWorkflow(
        ENTRY_ID,
        null,
        answer(new Response('x', { status: 401 })),
      ),
    ).toEqual({ kind: 'signed-out' });
    for (const status of [403, 404])
      expect(
        await readCanonicalWorkflow(
          ENTRY_ID,
          null,
          answer(new Response('x', { status })),
        ),
      ).toEqual({ kind: 'gone' });
  });

  it('falls back to the global fetch', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = answer(
      jsonResponse(200, workflowFixture(), { etag: '"x"' }),
    ) as unknown as typeof fetch;
    try {
      expect((await readCanonicalWorkflow(ENTRY_ID, null)).kind).toBe('ok');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('readCanonicalReview', () => {
  it('reads the review detail and checks its identity and validator', async () => {
    const resource = reviewDetailFixture();
    const fetcher = answer(jsonResponse(200, resource, { etag: '"2"' }));
    expect(await readCanonicalReview(REVIEW_ID, fetcher)).toEqual({
      kind: 'ok',
      resource,
    });
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(
      `/api/v1/cms/reviews/${REVIEW_ID}`,
    );
    for (const response of [
      jsonResponse(200, resource, { etag: '"9"' }),
      jsonResponse(200, reviewDetailFixture({ id: SCHEMA_VERSION_ID }), {
        etag: '"2"',
      }),
      jsonResponse(200, resource),
    ])
      expect(
        (await readCanonicalReview(REVIEW_ID, answer(response))).kind,
      ).toBe('degraded');
  });

  it('maps the same statuses as the workflow read', async () => {
    expect(
      await readCanonicalReview(
        REVIEW_ID,
        answer(new Response('x', { status: 401 })),
      ),
    ).toEqual({ kind: 'signed-out' });
    expect(
      await readCanonicalReview(
        REVIEW_ID,
        answer(new Response('x', { status: 404 })),
      ),
    ).toEqual({ kind: 'gone' });
    expect(
      (
        await readCanonicalReview(
          REVIEW_ID,
          answer(new Response('x', { status: 429 })),
        )
      ).kind,
    ).toBe('degraded');
  });
});
