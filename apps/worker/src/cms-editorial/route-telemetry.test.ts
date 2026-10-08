import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildRouteEvent,
  entryFacts,
  metricOutcome,
  type RouteFacts,
} from './route-telemetry';
import type { CmsEditorialError } from './types';

/**
 * The redacted per-request event (BE03b "Observability"): trace and correlation
 * identity, the closed conflict reason, the closed error code, replays and the
 * hashed entry. Each is derived only from closed vocabularies and safe tokens,
 * never from a body, a value or free text.
 */

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRACE = '0af7651916cd43dd8448eb211c80319c';

const policy = (operationId: string) => {
  const found = cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  );
  if (found === undefined) throw new Error(operationId);
  return found;
};

const build = (
  operationId: string,
  status: number,
  facts: RouteFacts = {},
  headers: Record<string, string> = {},
) =>
  buildRouteEvent(
    {
      request: new Request('https://web.test/api/v1/cms/entries', { headers }),
      requestId: REQUEST_ID,
      policy: policy(operationId),
      startedAt: 100,
      now: 140,
    },
    new Response(null, { status }),
    facts,
  );

const failure = (
  status: CmsEditorialError['status'],
  code: string,
  details: Record<string, unknown> = {},
): CmsEditorialError => ({ ok: false, status, code, message: 'x', details });

describe('trace and correlation identity', () => {
  it('adopts a well-formed W3C trace id and a safe correlation id', () => {
    const event = build(
      'CMS-03B-11',
      200,
      {},
      {
        traceparent: `00-${TRACE}-b7ad6b7169203331-01`,
        'x-correlation-id': 'corr-123.abc:9',
      },
    );
    expect(event.traceId).toBe(TRACE);
    expect(event.correlationId).toBe('corr-123.abc:9');
  });

  it.each([
    'garbage',
    `00-${TRACE.slice(0, 31)}-b7ad6b7169203331-01`,
    `00-${TRACE.toUpperCase()}-b7ad6b7169203331-01`,
  ])('falls back to the request id for the trace parent %s', (traceparent) => {
    expect(build('CMS-03B-11', 200, {}, { traceparent }).traceId).toBe(
      REQUEST_ID,
    );
  });

  it.each(['has space', 'semi;colon', '-leading-dash', 'x'.repeat(201)])(
    'falls back to the request id for the unsafe correlation id %j',
    (supplied) => {
      expect(
        build('CMS-03B-11', 200, {}, { 'x-correlation-id': supplied })
          .correlationId,
      ).toBe(REQUEST_ID);
    },
  );

  it('uses the request id when neither header is sent', () => {
    const event = build('CMS-03B-11', 200);
    expect(event.traceId).toBe(REQUEST_ID);
    expect(event.correlationId).toBe(REQUEST_ID);
  });
});

describe('a 409 names only a closed conflict reason', () => {
  const reasonOf = (conflict: unknown): string | undefined => {
    const metrics = build('CMS-03B-01', 409, {
      error: failure(409, 'CONFLICT', { conflict }),
    }).metrics;
    const key = Object.keys(metrics ?? {}).find((name) =>
      name.startsWith('cms_editorial_conflict_total'),
    );
    return key?.match(/reason="([A-Z_]+)"/u)?.[1];
  };

  it.each(['VERSION_MISMATCH', 'IDEMPOTENCY_MISMATCH', 'INVALID_TRANSITION'])(
    'keeps the registered reason %s',
    (conflict) => expect(reasonOf(conflict)).toBe(conflict),
  );

  it.each(['something else', undefined, 7])(
    'reports an unregistered reason (%j) as INVALID_TRANSITION',
    (conflict) => expect(reasonOf(conflict)).toBe('INVALID_TRANSITION'),
  );

  it('counts the conflict when the error carries no details at all', () => {
    const metrics = build('CMS-03B-02', 409, {
      error: { ok: false, status: 409, code: 'CONFLICT', message: 'x' },
    }).metrics;
    expect(
      Object.keys(metrics ?? {}).some((name) =>
        name.includes('INVALID_TRANSITION'),
      ),
    ).toBe(true);
  });
});

describe('error, success, replay and entry facts', () => {
  it('labels an unregistered error code as UNREGISTERED and defaults a missing one', () => {
    const odd = build('CMS-03B-11', 404, { error: failure(404, 'not a code') });
    expect(JSON.stringify(odd.metrics)).toContain('UNREGISTERED');
    const none = build('CMS-03B-11', 503);
    expect(JSON.stringify(none.metrics)).toContain('INTERNAL_ERROR');
  });

  it('counts a created revision for a command and a replay as no second creation', () => {
    expect(build('CMS-03B-01', 201).metrics).toHaveProperty(
      'cms_revision_created_total',
      1,
    );
    const replay = build('CMS-03B-10', 201, { replayed: true }).metrics;
    expect(replay).not.toHaveProperty('cms_revision_created_total');
    expect(replay).toHaveProperty('cms_entry_create_replayed_total', 1);
    expect(build('CMS-03B-02', 201).metrics).toHaveProperty(
      'cms_conflict_closed_total',
      1,
    );
    expect(build('CMS-03B-03', 200).metrics).not.toHaveProperty(
      'cms_revision_created_total',
    );
  });

  it('records validation failures, rate limits and a recorded conflict', () => {
    expect(
      build('CMS-03B-01', 422, { error: failure(422, 'VALIDATION_FAILED') })
        .metrics,
    ).toHaveProperty('cms_revision_validation_failed_total', 1);
    expect(
      build('CMS-03B-01', 429, { error: failure(429, 'RATE_LIMITED') }).metrics,
    ).toHaveProperty('cms_editorial_rate_limited_total', 1);
    const recorded = build('CMS-03B-01', 409, {
      error: failure(409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        expectedVersion: '3',
        currentVersion: '4',
      }),
    }).metrics;
    expect(recorded).toHaveProperty('cms_conflict_open_total', 1);
    expect(recorded).toHaveProperty('cms_conflict_records_created_total', 1);
  });

  it('adds the create and draft-detail outcome counters', () => {
    expect(
      build('CMS-03B-10', 409, { error: failure(409, 'CONFLICT') }).metrics,
    ).toHaveProperty('cms_entry_create_conflict_total', 1);
    expect(
      build('CMS-03B-11', 403, { error: failure(403, 'FORBIDDEN') }).metrics,
    ).toHaveProperty('cms_entry_draft_detail_denied_total', 1);
  });

  it('keeps only safe aggregate counts', () => {
    const metrics = build('CMS-03B-03', 200, {
      counts: {
        items_returned: 4,
        'Bad Name': 1,
        negative_count: -1,
        not_finite: Number.NaN,
      },
    }).metrics;
    expect(metrics).toHaveProperty('items_returned', 4);
    expect(metrics).not.toHaveProperty('Bad Name');
    expect(metrics).not.toHaveProperty('negative_count');
    expect(metrics).not.toHaveProperty('not_finite');
  });

  it('names a dependency only for a 502-504 with a safe class, and hashes the entry', async () => {
    expect(
      build('CMS-03B-11', 503, {
        error: failure(503, 'DEPENDENCY_UNAVAILABLE', {
          dependencyClass: 'cms_editorial',
        }),
      }).dependency,
    ).toBe('cms_editorial');
    expect(
      build('CMS-03B-11', 503, {
        error: failure(503, 'DEPENDENCY_UNAVAILABLE', {
          dependencyClass: 'has space',
        }),
      }),
    ).not.toHaveProperty('dependency');
    expect(
      build('CMS-03B-11', 409, {
        error: failure(409, 'CONFLICT', { dependencyClass: 'cms_editorial' }),
      }),
    ).not.toHaveProperty('dependency');
    const withVersion = build('CMS-03B-11', 200, {
      entry: await entryFacts('30000000-0000-4000-8000-000000000003', '7'),
    });
    expect(withVersion.entityVersion).toBe('7');
    expect(withVersion.entityIdHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const withoutVersion = build('CMS-03B-11', 200, {
      entry: await entryFacts('30000000-0000-4000-8000-000000000003'),
    });
    expect(withoutVersion).not.toHaveProperty('entityVersion');
  });

  it('classifies the metric outcome from the status', () => {
    expect(
      [200, 429, 401, 403, 404, 409, 400, 415, 422, 500, 503].map(
        metricOutcome,
      ),
    ).toEqual([
      'success',
      'rate_limited',
      'denied',
      'denied',
      'denied',
      'conflict',
      'invalid',
      'invalid',
      'invalid',
      'failed',
      'failed',
    ]);
  });
});
