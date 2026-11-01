import { describe, expect, it, vi } from 'vitest';

import { relatedContentPath } from './related-content-submit';

import {
  ENTRY,
  EXCL,
  IDEMPOTENCY_KEY,
  PIN,
  answering,
  error,
  json,
  request,
  resource,
  send,
} from './related-content-submit.test-support';

describe('the request', () => {
  it('posts the same-origin JSON command with csrf, idempotency key and the exact strong If-Match', async () => {
    const fetcher = vi.fn(async () => json(201, resource(), { etag: '"5"' }));
    await send(fetcher as unknown as typeof fetch);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(relatedContentPath(ENTRY));
    expect(url).toBe(`/api/v1/cms/entries/${ENTRY}/related-content`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-1',
      'idempotency-key': IDEMPOTENCY_KEY,
      'if-match': '"4"',
    });
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it('never sends an authority claim, an owner or a stepUpAt member', async () => {
    const fetcher = vi.fn(async () => json(201, resource(), { etag: '"5"' }));
    await send(fetcher as unknown as typeof fetch);
    const sent = JSON.parse(
      (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual([
      'derivedRule',
      'entryId',
      'exclusions',
      'expectedVersion',
      'pins',
    ]);
  });
});

describe('a 201', () => {
  it('is saved only when it is the answer to this request: entry, ordered pins, exclusions, rule, next version', async () => {
    const result = await send(
      answering(json(201, resource(), { etag: '"5"' })),
    );
    expect(result).toEqual({
      kind: 'saved',
      saved: {
        version: '5',
        eligibleCount: 3,
        pins: [PIN],
        exclusions: [EXCL],
        derivedRule: { key: 'shared-terms', version: '1' },
      },
    });
  });

  it('accepts a null rule and a zero eligible count', async () => {
    const result = await send(
      answering(
        json(201, resource({ derivedRule: null, eligibleCount: 0 }), {
          etag: '"5"',
        }),
      ),
      { ...request, derivedRule: null },
    );
    expect(result.kind).toBe('saved');
  });

  it.each([
    ['another entry', { sourceEntryId: PIN }],
    ['pins reordered', { pins: [PIN, EXCL] }],
    ['an extra exclusion', { exclusions: [EXCL, PIN] }],
    [
      'a different rule key',
      { derivedRule: { key: 'same-type-recent', version: '1' } },
    ],
    [
      'a different rule version',
      { derivedRule: { key: 'shared-terms', version: '2' } },
    ],
    ['a rule the request did not ask for', { derivedRule: null }],
    ['a revoked state', { state: 'revoked' }],
    ['a negative count', { eligibleCount: -1 }],
    ['a fractional count', { eligibleCount: 1.5 }],
    ['a count over 128', { eligibleCount: 129 }],
    ['a string count', { eligibleCount: '3' }],
  ])('is an unknown outcome when the body carries %s', async (_name, extra) => {
    expect(
      await send(answering(json(201, resource(extra), { etag: '"5"' }))),
    ).toEqual({ kind: 'uncertain' });
  });

  it.each(['"4"', '"6"', 'W/"5"', '5', ''])(
    'is an unknown outcome when the ETag is %j rather than the next entry version',
    async (etag) => {
      const headers: Record<string, string> = etag === '' ? {} : { etag };
      expect(await send(answering(json(201, resource(), headers)))).toEqual({
        kind: 'uncertain',
      });
    },
  );

  it('is an unknown outcome for a non-JSON body, a 200, a 202 and the unknown-outcome header', async () => {
    expect(
      await send(
        answering(
          new Response('<html>', { status: 201, headers: { etag: '"5"' } }),
        ),
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(
      await send(answering(json(200, resource(), { etag: '"5"' }))),
    ).toEqual({
      kind: 'uncertain',
    });
    expect(
      await send(answering(json(202, resource(), { etag: '"5"' }))),
    ).toEqual({
      kind: 'uncertain',
    });
    expect(
      await send(
        answering(
          json(201, resource(), {
            etag: '"5"',
            'x-cms-editorial-outcome': 'unknown',
          }),
        ),
      ),
    ).toEqual({ kind: 'uncertain' });
  });
});

describe('a 201 for a request without a rule', () => {
  it('is an unknown outcome when the body names a rule nobody asked for', async () => {
    expect(
      await send(answering(json(201, resource(), { etag: '"5"' })), {
        ...request,
        derivedRule: null,
      }),
    ).toEqual({ kind: 'uncertain' });
  });
});

describe('other answers', () => {
  it('does not send a request for an entry id that is not a UUID', async () => {
    const fetcher = vi.fn(async () => json(201, resource(), { etag: '"5"' }));
    expect(
      await send(fetcher as unknown as typeof fetch, {
        ...request,
        entryId: 'nope',
      }),
    ).toEqual({ kind: 'uncertain' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads a 200 that carries an error-shaped body as unknown, never as a rejection', async () => {
    expect(await send(answering(json(200, { details: {} })))).toEqual({
      kind: 'uncertain',
    });
  });

  it('gives a typed 403 no rows even when violations arrive', async () => {
    expect(
      await send(
        answering(
          error(403, {
            reasonCode: 'capability_missing',
            violations: [{ path: '/pins/0', code: 'x_y', message: 'x' }],
          }),
        ),
      ),
    ).toEqual({
      kind: 'refused',
      status: 403,
      reason: 'capability_missing',
      rows: [],
    });
  });

  it('ignores a pointer into the rule or any list other than pins and exclusions', async () => {
    const result = await send(
      answering(
        error(422, {
          reasonCode: 'related_target_ineligible',
          violations: [
            { path: '/derivedRule/0', code: 'x_y', message: 'x' },
            { path: '/pin/0', code: 'x_y', message: 'x' },
          ],
        }),
      ),
    );
    expect(result).toMatchObject({ rows: [] });
  });
});

describe('refusals', () => {
  it('reads a 409 as a plain conflict with the current version when it is well formed', async () => {
    expect(
      await send(
        answering(error(409, { expectedVersion: '4', currentVersion: '6' })),
      ),
    ).toEqual({ kind: 'conflict', currentVersion: '6' });
    expect(
      await send(answering(error(409, { currentVersion: 'six' }))),
    ).toEqual({
      kind: 'conflict',
      currentVersion: null,
    });
    expect(await send(answering(error(409)))).toEqual({
      kind: 'conflict',
      currentVersion: null,
    });
  });

  it('reads the typed 403 as the missing capability and an untyped 403 as a plain rejection', async () => {
    expect(
      await send(answering(error(403, { reasonCode: 'capability_missing' }))),
    ).toEqual({
      kind: 'refused',
      status: 403,
      reason: 'capability_missing',
      rows: [],
    });
    expect(await send(answering(error(403)))).toEqual({
      kind: 'rejected',
      status: 403,
    });
    expect(
      await send(answering(error(403, { reasonCode: 'separation_of_duties' }))),
    ).toEqual({ kind: 'rejected', status: 403 });
  });

  it('reads the uniform 422 with the offending rows from the violation pointers', async () => {
    const result = await send(
      answering(
        error(422, {
          reasonCode: 'related_target_ineligible',
          violations: [
            {
              path: '/pins/0',
              code: 'related_target_ineligible',
              message: 'x',
            },
            {
              path: '/exclusions/0',
              code: 'related_target_ineligible',
              message: 'x',
            },
          ],
        }),
      ),
    );
    expect(result).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'related_target_ineligible',
      rows: [
        { list: 'pins', index: 0 },
        { list: 'exclusions', index: 0 },
      ],
    });
  });

  it('keeps the refusal when no pointer arrives: the form shows its one fixed message', async () => {
    expect(
      await send(
        answering(error(422, { reasonCode: 'related_target_ineligible' })),
      ),
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'related_target_ineligible',
      rows: [],
    });
  });

  it('ignores a pointer that is not a pin or exclusion row, is malformed, or repeats', async () => {
    const result = await send(
      answering(
        error(422, {
          reasonCode: 'related_target_ineligible',
          violations: [
            { path: '/derivedRule/key', code: 'x_y', message: 'x' },
            { path: '/pins/-1', code: 'x_y', message: 'x' },
            { path: '/pins/01', code: 'x_y', message: 'x' },
            { path: '/pins/1/extra', code: 'x_y', message: 'x' },
            { path: '/pins/2', code: 'x_y', message: 'x' },
            { path: '/pins/2', code: 'x_y', message: 'x' },
            'not an object',
          ],
        }),
      ),
    );
    expect(result).toMatchObject({ rows: [{ list: 'pins', index: 2 }] });
  });

  it('reads an unknown derived rule and treats any other 422 token as a plain rejection', async () => {
    expect(
      await send(answering(error(422, { reasonCode: 'derived_rule_unknown' }))),
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'derived_rule_unknown',
      rows: [],
    });
    expect(
      await send(answering(error(422, { reasonCode: 'key_reserved' }))),
    ).toEqual({
      kind: 'rejected',
      status: 422,
    });
    expect(await send(answering(error(422)))).toEqual({
      kind: 'rejected',
      status: 422,
    });
  });

  it.each([400, 401, 404, 415, 500, 502, 503, 504])(
    'reads the catalog %i as a plain rejection',
    async (status) => {
      expect(await send(answering(error(status)))).toEqual({
        kind: 'rejected',
        status,
      });
    },
  );

  it('waits for a verified 429 and treats an unverifiable one as unknown', async () => {
    expect(
      await send(
        answering(
          error(429, { retryAfterSeconds: 12 }, { 'retry-after': '12' }),
        ),
      ),
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 12 });
    expect(await send(answering(error(429)))).toEqual({ kind: 'uncertain' });
    expect(
      await send(
        answering(
          error(429, { retryAfterSeconds: 5 }, { 'retry-after': '12' }),
        ),
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(
      await send(answering(error(429, {}, { 'retry-after': '99999999' }))),
    ).toEqual({ kind: 'uncertain' });
  });

  it('treats an error whose code is not its status catalog code, a non-JSON error and a thrown fetch as unknown', async () => {
    expect(
      await send(
        answering(json(422, { code: 'INVALID_REQUEST', details: {} })),
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(
      await send(answering(new Response('boom', { status: 500 }))),
    ).toEqual({
      kind: 'uncertain',
    });
    expect(
      await send((async () => {
        throw new TypeError('network');
      }) as unknown as typeof fetch),
    ).toEqual({ kind: 'uncertain' });
    expect(await send(answering(json(418, {})))).toEqual({ kind: 'uncertain' });
  });
});
