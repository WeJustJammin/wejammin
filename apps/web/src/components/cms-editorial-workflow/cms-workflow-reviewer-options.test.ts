// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse } from './cms-workflow-fixtures.test-support';
import { loadReviewerOptions } from './cms-workflow-reviewer-options';

const grant = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `123e4567-e89b-42d3-a456-4266141770${String(n).padStart(2, '0')}`,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  resourceKind: 'cms_capability_grant',
  state: 'active',
  subjectPersonId: `123e4567-e89b-42d3-a456-4266141780${String(n).padStart(2, '0')}`,
  capability: 'cms.reviewer',
  validFrom: '2026-10-01',
  validThrough: '2026-10-31',
  endsAt: '2026-11-01T00:00:00Z',
  lastAction: 'granted',
  reason: null,
  ...overrides,
});

const page = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

const answer = (...responses: (Response | Error)[]) => {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift() as Response | Error;
    if (next instanceof Error) throw next;
    return next;
  });
};

describe('loadReviewerOptions', () => {
  it('reads the owner-only active cms.reviewer grants no-store and offers each person once', async () => {
    const fetcher = answer(
      jsonResponse(
        200,
        page([grant(1), grant(2), grant(1, { id: grant(3).id })]),
      ),
    );
    const result = await loadReviewerOptions(fetcher);
    expect(result).toEqual({
      kind: 'ok',
      options: [
        { personId: grant(1).subjectPersonId, endsAt: grant(1).endsAt },
        { personId: grant(2).subjectPersonId, endsAt: grant(2).endsAt },
      ],
    });
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(
      '/api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100',
    );
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('same-origin');
  });

  it('follows the cursor to the next page and stops after five pages', async () => {
    const fetcher = answer(
      jsonResponse(200, page([grant(1)], 'c1')),
      jsonResponse(200, page([grant(2)], null)),
    );
    const result = await loadReviewerOptions(fetcher);
    expect(result.kind === 'ok' && result.options).toHaveLength(2);
    expect((fetcher.mock.calls[1] as unknown as [string])[0]).toContain(
      '&cursor=c1',
    );
    const endless = vi.fn(async () =>
      jsonResponse(200, page([grant(1)], 'again')),
    );
    await loadReviewerOptions(endless);
    expect(endless).toHaveBeenCalledTimes(5);
  });

  it('is unavailable for a denied, failed or non-strict answer', async () => {
    for (const response of [
      new Response('x', { status: 403 }),
      new Response('x', { status: 503 }),
      jsonResponse(200, { items: 'no' }),
      new Response('nope', { status: 200 }),
      new Error('offline'),
    ])
      expect(await loadReviewerOptions(answer(response))).toEqual({
        kind: 'unavailable',
      });
  });

  it('falls back to the global fetch', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = answer(
      jsonResponse(200, page([])),
    ) as unknown as typeof fetch;
    try {
      expect(await loadReviewerOptions()).toEqual({ kind: 'ok', options: [] });
    } finally {
      globalThis.fetch = original;
    }
  });
});
