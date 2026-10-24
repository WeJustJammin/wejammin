import { describe, expect, it, vi } from 'vitest';

import {
  create,
  entryId,
  READ_RPC,
  readAs,
  readInput,
  readRoute,
  resource,
  signal,
} from './cms-composition-production-related-read.test-support';
import {
  json,
  pinA,
  raised,
} from './cms-composition-production-related.test-support';
import { createCmsRelatedContentApp } from './cms-composition/related-content-routes';
import { PARTY_ID, USER_ID } from './cms-editorial-production.test-support';

const answer = (rule: unknown = resource) => ({ rule });

describe('cmsRelatedContentRead production adapter (DEC-195)', () => {
  it('calls only the named read RPC with the server-bound context and path entry', async () => {
    const fetchImpl = vi.fn(async () => json(answer()));
    const result = await readAs(fetchImpl as typeof fetch);
    expect(result).toEqual({ ok: true, value: answer() });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(READ_RPC);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('cmsRelatedContentRead');
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers).not.toHaveProperty('X-Idempotency-Key');
    expect(headers).not.toHaveProperty('If-Match');
    const sent = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(sent)).toEqual(['p_request']);
    expect(Object.keys(sent.p_request).sort()).toEqual([
      'context',
      'correlationId',
      'entryId',
    ]);
    expect(sent.p_request).toMatchObject({
      entryId,
      context: { authUserId: USER_ID, actingPartyId: PARTY_ID },
    });
  });

  it('answers { rule: null } and sends the canonical lower-case entry id', async () => {
    const fetchImpl = vi.fn(async () => json({ rule: null }));
    const upper = entryId.toUpperCase();
    const result = await readAs(fetchImpl as typeof fetch, {
      path: { entryId: upper },
    });
    expect(result).toEqual({ ok: true, value: { rule: null } });
    const sent = JSON.parse(
      String(
        (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { p_request: { entryId: string } };
    expect(sent.p_request.entryId).toBe(entryId);
  });

  it('serves an editor-only session and keeps pins in stored order', async () => {
    const base = readInput();
    const reordered = {
      ...resource,
      pins: [resource.pins[1], resource.pins[0]],
    };
    const result = await readAs(
      (async () => json(answer(reordered))) as typeof fetch,
      {
        session: { ...base.session, capabilities: ['cms.editor'] },
      },
    );
    expect(result).toMatchObject({
      ok: true,
      value: { rule: { pins: reordered.pins } },
    });
  });

  it('rejects a wrong operation, entry id, authority or context before any transport', async () => {
    const fetchImpl = vi.fn(async () => json(answer()));
    const base = readInput();
    const bad: Array<[Parameters<typeof readInput>[0], number]> = [
      [{ operationId: 'CMS-03C-05' as never }, 400],
      [{ path: { entryId: 'invalid' } }, 400],
      [{ session: { ...base.session, actingPartyId: null } }, 403],
      [{ session: { ...base.session, capabilities: ['cms.reader'] } }, 403],
      [{ session: { ...base.session, capabilities: [] } }, 403],
    ];
    for (const [overrides, status] of bad) {
      const result = await readAs(fetchImpl as typeof fetch, overrides);
      expect(result, JSON.stringify(overrides)).toMatchObject({
        ok: false,
        status,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    const forbidden = await readAs(fetchImpl as typeof fetch, {
      session: { ...base.session, capabilities: [] },
    });
    expect(forbidden).toMatchObject({
      details: { reasonCode: 'capability_missing' },
    });
  });

  it("refuses an answer that is malformed, another entry's, revoked or outside the contract (502)", async () => {
    const other = '20000000-0000-4000-8000-000000000009';
    const answers: unknown[] = [
      resource,
      {},
      { rule: undefined },
      { ...answer(), extra: true },
      answer({ ...resource, ownerId: PARTY_ID }),
      answer({ ...resource, sourceEntryId: other }),
      answer({ ...resource, state: 'revoked', derivedRule: null }),
      answer({ ...resource, eligibleCount: 129 }),
      answer({ ...resource, pins: [pinA], exclusions: [pinA] }),
      'not an object',
      [],
    ];
    for (const value of answers) {
      const result = await readAs((async () => json(value)) as typeof fetch);
      expect(result, JSON.stringify(value)).toMatchObject({
        ok: false,
        status: 502,
      });
    }
  });

  it("maps the read's tokens: 403 capability_missing, 404, 400, 401", async () => {
    const forbidden = await readAs((async () =>
      raised('capability_missing')) as typeof fetch);
    expect(forbidden).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
    const table: Array<[string, number]> = [
      ['NOT_FOUND', 404],
      ['INVALID_REQUEST', 400],
      ['UNAUTHENTICATED', 401],
      ['RATE_LIMITED', 429],
    ];
    for (const [token, status] of table) {
      const result = await readAs((async () => raised(token)) as typeof fetch);
      expect(result, token).toMatchObject({ ok: false, status });
    }
  });

  it('scrubs a token the read cannot publish, a write-only status and a provider fault into a 500', async () => {
    const faults: Array<[string, () => Response]> = [
      [
        'write refusal',
        () => raised('related_target_ineligible', '["/pins/0"]'),
      ],
      [
        'rule refusal',
        () => raised('derived_rule_unknown', '["/derivedRule/key"]'),
      ],
      ['other domain', () => raised('pattern_cycle')],
      [
        'version conflict',
        () =>
          raised(
            'VERSION_MISMATCH',
            '{"expectedVersion":"1","currentVersion":"3"}',
          ),
      ],
      ['transition', () => raised('INVALID_TRANSITION')],
      ['idempotency', () => raised('IDEMPOTENCY_MISMATCH')],
      ['validation', () => raised('VALIDATION_FAILED', '["/entryId"]')],
      ['unregistered', () => raised('not_a_registered_token')],
      ['internal', () => raised('INTERNAL_ERROR')],
      ['PostgREST', () => json({ code: 'PGRST202', message: 'missing' }, 404)],
      ['sqlstate', () => json({ code: '42702', message: 'ambiguous' }, 400)],
      ['non object', () => json('not an object', 400)],
    ];
    for (const [name, fault] of faults) {
      const result = await readAs((async () => fault()) as typeof fetch);
      expect(result, name).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result), name).not.toContain('PGRST202');
      expect(JSON.stringify(result), name).not.toContain('related_target');
    }
  });

  it('maps provider outages and deadlines to 503 and 504', async () => {
    expect(
      await readAs((async () =>
        json({ message: 'down' }, 503)) as typeof fetch),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await readAs((async () => {
        throw new Error('connect ECONNREFUSED');
      }) as typeof fetch),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await readAs((async () => {
        throw new DOMException('aborted', 'AbortError');
      }) as typeof fetch),
    ).toMatchObject({ ok: false, status: 504 });
  });

  it('refuses an oversized RPC answer instead of buffering it', async () => {
    const result = await create((async () => json(answer())) as typeof fetch, {
      maxResponseBytes: 64,
    }).readRelatedContent(readInput(), signal());
    expect(result).toMatchObject({ ok: false });
    expect((result as { status: number }).status).toBeGreaterThanOrEqual(500);
  });

  it('serves the whole route: a stored rule is a 200 with the version as ETag', async () => {
    const fetchImpl = vi.fn(async () => json(answer()));
    const response = await createCmsRelatedContentApp(
      create(fetchImpl as typeof fetch),
    ).request(readRoute());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await response.json()).toEqual(answer());
  });

  it('serves the whole route: no rule is 200 { rule: null }; a visible source without edit is the typed 403', async () => {
    const none = await createCmsRelatedContentApp(
      create((async () => json({ rule: null })) as typeof fetch),
    ).request(readRoute());
    expect(none.status).toBe(200);
    expect(await none.json()).toEqual({ rule: null });
    const denied = await createCmsRelatedContentApp(
      create((async () => raised('capability_missing')) as typeof fetch),
    ).request(readRoute());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    const hidden = await createCmsRelatedContentApp(
      create((async () => raised('NOT_FOUND')) as typeof fetch),
    ).request(readRoute());
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({
      code: 'RELATED_CONTENT_NOT_FOUND',
      details: {},
    });
  });
});
