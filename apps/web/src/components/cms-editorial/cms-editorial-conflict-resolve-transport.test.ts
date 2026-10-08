import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  PARENT_A_ID,
  apiError,
  jsonResponse,
  resolvedTransportResource,
  resolveRequest,
  submitResolve,
} from './cms-editorial-conflict-resolve-test-support';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeCmsEditorialConflictResolve', () => {
  it('posts the verbatim explicit choice set with CAS headers', async () => {
    let seenUrl: string | undefined;
    let seenInit: RequestInit | undefined;
    const result = await submitResolve(async (input, init) => {
      seenUrl = String(input);
      seenInit = init;
      return jsonResponse(201, resolvedTransportResource(), {
        etag: '"8"',
        location:
          '/api/v1/cms/entries/' +
          ENTRY_ID +
          '/revisions/' +
          resolvedTransportResource().id,
      });
    });
    expect(seenUrl).toBe(
      '/api/v1/cms/entries/018f0c45-73fe-7dc2-9c09-68f7ecf132da/conflicts/018f0c45-73fe-7dc2-9c09-68f7ecf132db/resolve',
    );
    expect(seenInit?.method).toBe('POST');
    const headers = new Headers(seenInit?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('idempotency-key')).toBe(
      '0d9c1c2a-6f4f-4cde-9a3e-111111111111',
    );
    expect(headers.get('if-match')).toBe('"7"');
    expect(JSON.parse(String(seenInit?.body))).toEqual(resolveRequest());
    expect(result.outcome).toBe('success');
    expect(result.status).toBe(201);
    expect(result.resource?.parentRevisionIds).toHaveLength(2);
    expect(result.outcomeUnknown).toBe(false);
  });

  it('refuses locally when a choice smuggles a value or the list is empty', async () => {
    const smuggled = {
      ...resolveRequest(),
      choices: [
        {
          path: '/fields/018f0c45-73fe-7dc2-9c09-68f7ecf132e1',
          choice: 'theirs',
          value: 'x',
        },
      ],
    };
    const smuggledResult = await submitResolve(
      async () => jsonResponse(201, resolvedTransportResource()),
      { request: smuggled },
    );
    expect(smuggledResult.outcome).toBe('validation');
    expect(smuggledResult.status).toBeNull();
    expect(smuggledResult.resource).toBeNull();
    expect(smuggledResult.errorDetails.join(' ')).toContain('value');
    const empty = await submitResolve(
      async () => jsonResponse(201, resolvedTransportResource()),
      { request: { ...resolveRequest(), choices: [] } },
    );
    expect(empty.outcome).toBe('validation');
    expect(empty.outcomeUnknown).toBe(false);
  });

  it('reports unknown for a 201 that is not this verified two-parent result', async () => {
    const wrongConflict = {
      ...resolvedTransportResource(),
      conflictId: PARENT_A_ID,
    };
    const wrong = await submitResolve(async () =>
      jsonResponse(201, wrongConflict),
    );
    expect(wrong.outcome).toBe('unknown');
    expect(wrong.outcomeUnknown).toBe(true);
    const duplicateParents = {
      ...resolvedTransportResource(),
      parentRevisionIds: [PARENT_A_ID, PARENT_A_ID],
    };
    const duplicate = await submitResolve(async () =>
      jsonResponse(201, duplicateParents),
    );
    expect(duplicate.outcome).toBe('unknown');
    expect(duplicate.outcomeUnknown).toBe(true);
    const malformed = await submitResolve(async () =>
      jsonResponse(201, { nope: true }),
    );
    expect(malformed.outcome).toBe('unknown');
  });

  it('maps the declared failure statuses without inferring a winner', async () => {
    const cases: ReadonlyArray<{
      readonly status: number;
      readonly code: string;
      readonly outcome: string;
      readonly retryable: boolean;
    }> = [
      {
        status: 400,
        code: 'INVALID_REQUEST',
        outcome: 'validation',
        retryable: false,
      },
      {
        status: 401,
        code: 'UNAUTHENTICATED',
        outcome: 'unauthenticated',
        retryable: false,
      },
      {
        status: 403,
        code: 'FORBIDDEN',
        outcome: 'forbidden',
        retryable: false,
      },
      {
        status: 404,
        code: 'NOT_FOUND',
        outcome: 'not-found',
        retryable: false,
      },
      { status: 409, code: 'CONFLICT', outcome: 'conflict', retryable: false },
      {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        outcome: 'unsupported-media',
        retryable: false,
      },
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        outcome: 'validation',
        retryable: false,
      },
      {
        status: 429,
        code: 'RATE_LIMITED',
        outcome: 'rate-limited',
        retryable: true,
      },
      {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        outcome: 'degraded',
        retryable: true,
      },
    ];
    for (const example of cases) {
      const result = await submitResolve(async () =>
        jsonResponse(
          example.status,
          {
            ...apiError(example.code),
            details: example.status === 429 ? { retryAfterSeconds: 7 } : {},
          },
          example.status === 429 ? { 'retry-after': '7' } : undefined,
        ),
      );
      expect(result.outcome).toBe(example.outcome);
      expect(result.retryable).toBe(example.retryable);
      expect(result.outcomeUnknown).toBe(false);
      expect(result.resource).toBeNull();
    }
  });

  it('keeps the caller request untouched and choices preserved on refusal', async () => {
    const original = resolveRequest();
    const result = await submitResolve(
      async () => jsonResponse(409, apiError('CONFLICT')),
      { request: original },
    );
    expect(result.outcome).toBe('conflict');
    expect(result.request).toBe(original);
    expect(result.request.choices).toEqual(original.choices);
  });

  it('reports unknown on a lost response and keeps the idempotency key', async () => {
    const result = await submitResolve(async () => {
      throw new Error('network lost');
    });
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.idempotencyKey).toBe('0d9c1c2a-6f4f-4cde-9a3e-111111111111');
    expect(result.retryable).toBe(true);
  });

  it('keeps the resolution key when a 409 is not a verified conflict', async () => {
    const nextKey = vi.fn(() => 'fresh-key');
    const result = await submitResolve(
      async () => jsonResponse(409, apiError('UNAUTHENTICATED')),
      { createIdempotencyKey: nextKey },
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.idempotencyKey).toBe('0d9c1c2a-6f4f-4cde-9a3e-111111111111');
    expect(nextKey).not.toHaveBeenCalled();
  });

  it('rotates the key only when the next attempt is a new logical resolve', async () => {
    let rotated = 0;
    const nextKey = () => {
      rotated += 1;
      return 'rotated-' + String(rotated);
    };
    const definite = await submitResolve(
      async () => jsonResponse(409, apiError('CONFLICT')),
      { createIdempotencyKey: nextKey },
    );
    expect(definite.idempotencyKey).toBe('rotated-1');
    const uncertain = await submitResolve(
      async () => jsonResponse(429, apiError('RATE_LIMITED')),
      { createIdempotencyKey: nextKey },
    );
    expect(uncertain.idempotencyKey).toBe(
      '0d9c1c2a-6f4f-4cde-9a3e-111111111111',
    );
  });

  it('carries Retry-After seconds through the rate-limited result', async () => {
    const result = await submitResolve(async () =>
      jsonResponse(
        429,
        { ...apiError('RATE_LIMITED'), details: { retryAfterSeconds: 42 } },
        { 'retry-after': '42' },
      ),
    );
    expect(result.outcome).toBe('rate-limited');
    expect(result.retryAfterSeconds).toBe(42);
  });

  it('surfaces server violation paths for the validation summary', async () => {
    const result = await submitResolve(async () =>
      jsonResponse(422, {
        code: 'VALIDATION_FAILED',
        message: 'Check choices',
        requestId: ENTRY_ID,
        details: {
          violations: [
            { path: '/choices/0/value', message: 'schema mismatch' },
          ],
        },
      }),
    );
    expect(result.outcome).toBe('validation');
    expect(result.errorDetails).toEqual(['/choices/0/value']);
  });
});
