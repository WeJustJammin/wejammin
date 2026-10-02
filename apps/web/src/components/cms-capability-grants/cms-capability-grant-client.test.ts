import { describe, expect, it, vi } from 'vitest';

import {
  GRANT_ID,
  SUBJECT_ID,
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import { readGrantList, runGrantCommand } from './cms-capability-grant-client';

/**
 * The console's two transports: a reconciling command POST over the shared
 * registry executor, and a no-store JSON list read. Neither ever stores or
 * announces a person identifier.
 */

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const apiError = (code: string, details: unknown = {}) => ({
  code,
  details,
  message: 'Refused.',
  requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
});

const form = (fields: Record<string, string> = {}): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    operationId: 'CMS-03A-15',
    csrf: 'csrf',
    'idempotency-key': 'cms-grant-12345678',
    subjectPersonId: SUBJECT_ID,
    capability: 'cms.author',
    validThrough: '2026-12-30',
    ...fields,
  }))
    data.set(name, value);
  return data;
};

const command = (
  fetcher: typeof fetch,
  operationId = 'CMS-03A-15',
  fields = {},
) =>
  runGrantCommand({
    action: '/api/v1/cms/capability-grants',
    operationId,
    formData: form({ operationId, ...fields }),
    fetcher,
    sleep: async () => undefined,
  });

describe('runGrantCommand', () => {
  it('reports a 201 grant as success with the parsed resource', async () => {
    const fetcher = vi.fn(async () => json(201, grantResource()));
    const result = await command(fetcher);
    expect(result.outcome).toBe('success');
    expect(result.resource?.capability).toBe('cms.author');
    expect(result.attempts).toBe(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/capability-grants');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
  });

  it.each([
    ['CMS-03A-16', 200],
    ['CMS-03A-17', 200],
  ])('reports a %s %i as success', async (operationId, status) => {
    const result = await command(
      vi.fn(async () => json(status, grantResource({ version: '3' }))),
      operationId,
    );
    expect(result.outcome).toBe('success');
  });

  it('maps a 401 STEP_UP_REQUIRED to step-up-required and plain 401 to unauthenticated', async () => {
    const stepUp = await command(
      vi.fn(async () =>
        json(
          401,
          apiError('STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      ),
    );
    expect(stepUp.outcome).toBe('step-up-required');
    const plain = await command(
      vi.fn(async () => json(401, apiError('UNAUTHENTICATED'))),
    );
    expect(plain.outcome).toBe('unauthenticated');
  });

  it.each([
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
  ])('maps %i to %s', async (status, outcome) => {
    const result = await command(
      vi.fn(async () => json(status, apiError('X'))),
    );
    expect(result.outcome).toBe(outcome);
  });

  it('extracts violation pointers and codes from a 422 and never the values', async () => {
    const result = await command(
      vi.fn(async () =>
        json(
          422,
          apiError('VALIDATION_FAILED', {
            violations: [
              {
                pointer: '/validThrough',
                code: 'grant_term_spans_at_most_ninety_utc_days',
                value: SUBJECT_ID,
              },
              { pointer: '/capability', code: 'not_grantable' },
            ],
          }),
        ),
      ),
    );
    expect(result.outcome).toBe('validation');
    expect(result.requestId).toBe('6a3173d9-f113-4aa4-91c3-3fbc137ea258');
    expect(result.violations).toStrictEqual([
      {
        pointer: '/validThrough',
        code: 'grant_term_spans_at_most_ninety_utc_days',
      },
      { pointer: '/capability', code: 'not_grantable' },
    ]);
  });

  it('carries Retry-After for a 429', async () => {
    const result = await command(
      vi.fn(async () =>
        json(429, apiError('RATE_LIMITED'), { 'retry-after': '9' }),
      ),
    );
    expect(result.outcome).toBe('rate-limited');
    expect(result.retryAfterSeconds).toBe(9);
  });

  it('[P2-S09-AC-1007] [P2-S09-AC-1047] reconciles an ambiguous 503 by replaying the same key and reports the committed result', async () => {
    const responses = [
      json(503, apiError('DEPENDENCY_UNAVAILABLE')),
      json(201, grantResource()),
    ];
    const fetcher = vi.fn(async () => responses.shift() as Response);
    const result = await command(fetcher);
    expect(result.outcome).toBe('success');
    expect(result.reconciled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const keys = fetcher.mock.calls.map((call) =>
      ((call as unknown as [string, RequestInit])[1].body as FormData).get(
        'idempotency-key',
      ),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('[P2-S09-AC-1007] [P2-S09-AC-1047] stays degraded and never guesses success when the replay is also unavailable', async () => {
    const fetcher = vi.fn(async () =>
      json(503, apiError('DEPENDENCY_UNAVAILABLE')),
    );
    const result = await command(fetcher);
    expect(result.outcome).toBe('degraded');
    expect(result.resource).toBeNull();
  });

  it('degrades on a network failure', async () => {
    const result = await command(
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    expect(result.outcome).toBe('degraded');
  });
});

describe('readGrantList', () => {
  const query = { limit: 25, sort: 'updatedAt', direction: 'desc' } as const;

  it('requests the validated query and the island-local person filter with no-store', async () => {
    const fetcher = vi.fn(async () => json(200, grantListPage()));
    const result = await readGrantList({
      query: { ...query, capability: 'cms.editor', state: 'active' },
      subjectPersonId: SUBJECT_ID,
      fetcher,
    });
    expect(result.kind).toBe('ok');
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const parsed = new URL(url, 'https://app.test');
    expect(parsed.pathname).toBe('/api/v1/cms/capability-grants');
    expect(parsed.searchParams.get('capability')).toBe('cms.editor');
    expect(parsed.searchParams.get('subjectPersonId')).toBe(SUBJECT_ID);
    expect((init.headers as Headers).get('cache-control')).toBe('no-store');
    expect(init.credentials).toBe('same-origin');
  });

  it('omits the person filter when blank', async () => {
    const fetcher = vi.fn(async () => json(200, grantListPage()));
    await readGrantList({ query, subjectPersonId: '', fetcher });
    expect(
      String((fetcher.mock.calls[0] as unknown as [string])[0]),
    ).not.toContain('subjectPersonId');
  });

  it('parses the page and rejects a contract-invalid body', async () => {
    const ok = await readGrantList({
      query,
      fetcher: vi.fn(async () =>
        json(200, grantListPage([grantResource({ id: GRANT_ID })])),
      ),
    });
    expect(ok.kind === 'ok' && ok.page.items[0]?.id).toBe(GRANT_ID);
    const bad = await readGrantList({
      query,
      fetcher: vi.fn(async () => json(200, { items: [{}] })),
    });
    expect(bad.kind).toBe('invalid');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ])('maps %i to %s', async (status, kind) => {
    const result = await readGrantList({
      query,
      fetcher: vi.fn(async () => json(status, apiError('X'))),
    });
    expect(result.kind).toBe(kind);
  });

  it('[P2-S09-AC-997] marks 429 and 502/503/504 as retryable errors with Retry-After', async () => {
    for (const status of [429, 502, 503, 504]) {
      const result = await readGrantList({
        query,
        fetcher: vi.fn(async () =>
          json(status, apiError('X'), { 'retry-after': '4' }),
        ),
      });
      expect(result.kind).toBe('error');
      if (result.kind === 'error') {
        expect(result.status).toBe(status);
        expect(result.retryable).toBe(true);
        expect(result.retryAfterSeconds).toBe(4);
      }
    }
  });

  it('is a non-retryable error for other statuses and degraded when unreachable', async () => {
    const other = await readGrantList({
      query,
      fetcher: vi.fn(async () => json(400, apiError('X'))),
    });
    expect(other.kind === 'error' && other.retryable).toBe(false);
    const down = await readGrantList({
      query,
      fetcher: vi.fn(async () => {
        throw new TypeError('offline');
      }),
    });
    expect(down.kind).toBe('degraded');
  });
});
