import { describe, expect, it, vi } from 'vitest';

import {
  entryId,
  pinA,
  pinB,
  excluded,
  path,
  RPC,
  portInput,
  resource,
  json,
  raised,
  create,
  routeRequest,
  signal,
  act,
} from './cms-composition-production-related.test-support';
import {
  createCmsRelatedContentApp,
  type CmsRelatedContentPortInput,
} from './cms-composition/related-content-routes';
import {
  environment,
  PARTY_ID,
  USER_ID,
} from './cms-editorial-production.test-support';
import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';

describe('CMS-03C-05 production related-content adapter', () => {
  it('calls only the named server RPC with server-bound context and returns the contract resource', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const result = await act(fetchImpl as typeof fetch);
    expect(result).toEqual({ ok: true, value: resource });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(RPC);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('CMS-03C-05');
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers['X-Idempotency-Key']).toBe('related-content-0001');
    expect(headers['If-Match']).toBe('"1"');
    const sent = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(sent.p_request).toMatchObject({
      entryId,
      pins: [pinA, pinB],
      exclusions: [excluded],
      derivedRule: { key: 'shared-terms', version: '1', maxCandidates: 8 },
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: 'related-content-0001',
      context: { authUserId: USER_ID, actingPartyId: PARTY_ID },
    });
    expect(sent.p_request).not.toHaveProperty('ownerId');
    expect(Object.keys(sent)).toEqual(['p_request']);
  });

  it('sends a null derived rule as JSON null and admits an editor-only session', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ ...resource, derivedRule: null }),
    );
    const base = portInput();
    const result = await act(fetchImpl as typeof fetch, {
      session: { ...base.session, capabilities: ['cms.editor'] },
      body: { ...base.body, derivedRule: null },
    });
    expect(result).toMatchObject({ ok: true });
    const sent = JSON.parse(
      String(
        (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { p_request: { derivedRule: unknown } };
    expect(sent.p_request.derivedRule).toBeNull();
  });

  it('rejects a malformed command, header, authority or context before any transport', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const base = portInput();
    const bad: Array<[Partial<CmsRelatedContentPortInput>, number]> = [
      [{ operationId: 'wrong' as never }, 400],
      [{ path: { entryId: 'invalid' } }, 400],
      [{ idempotencyKey: 'short' }, 400],
      [{ ifMatch: '2' }, 400],
      [{ body: { ...base.body, entryId: pinA } }, 400],
      [{ body: { ...base.body, expectedVersion: '2' } }, 400],
      [{ body: { ...base.body, pins: [pinA, pinA] } }, 422],
      [{ body: { ...base.body, pins: [pinA], exclusions: [pinA] } }, 422],
      [
        {
          body: {
            ...base.body,
            derivedRule: {
              key: 'shared-terms',
              version: '1',
              reasonCode: 'shared_terms',
              maxCandidates: 0,
            },
          },
        },
        422,
      ],
      [{ session: { ...base.session, actingPartyId: null } }, 403],
      [{ session: { ...base.session, capabilities: ['cms.reader'] } }, 403],
    ];
    for (const [overrides, status] of bad) {
      const result = await act(fetchImpl as typeof fetch, overrides);
      expect(result, JSON.stringify(Object.keys(overrides))).toMatchObject({
        ok: false,
        status,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('names capability_missing on a refused session capability', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const base = portInput();
    const result = await act(fetchImpl as typeof fetch, {
      session: { ...base.session, capabilities: [] },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
  });

  it('refuses a resource that is malformed or does not answer the request', async () => {
    const answers = [
      { ...resource, ownerId: PARTY_ID },
      { ...resource, sourceEntryId: pinA },
      { ...resource, pins: [pinB, pinA] },
      { ...resource, exclusions: [] },
      { ...resource, eligibleCount: 129 },
      { unexpected: true },
    ];
    for (const answer of answers) {
      const result = await act((async () => json(answer)) as typeof fetch);
      expect(result, JSON.stringify(answer)).toMatchObject({
        ok: false,
        status: 502,
      });
    }
  });

  it('maps the typed uniform refusal to a 422 with the offending row pointers', async () => {
    const result = await act((async () =>
      raised(
        'related_target_ineligible',
        '["/pins/1","/exclusions/0"]',
      )) as typeof fetch);
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      details: {
        reasonCode: 'related_target_ineligible',
        violations: [
          { path: '/pins/1', code: 'related_target_ineligible' },
          { path: '/exclusions/0', code: 'related_target_ineligible' },
        ],
      },
    });
  });

  it('maps derived_rule_unknown, capability_missing and the schema failure', async () => {
    const unknown = await act((async () =>
      raised('derived_rule_unknown', '["/derivedRule/key"]')) as typeof fetch);
    expect(unknown).toMatchObject({
      status: 422,
      details: {
        reasonCode: 'derived_rule_unknown',
        violations: [{ path: '/derivedRule/key' }],
      },
    });
    const forbidden = await act((async () =>
      raised('capability_missing')) as typeof fetch);
    expect(forbidden).toMatchObject({
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
    const schema = await act((async () =>
      raised('VALIDATION_FAILED', '["/pins/1"]')) as typeof fetch);
    expect(schema).toMatchObject({
      status: 422,
      details: { violations: [{ path: '/pins/1' }] },
    });
  });

  it('maps the generic BE03b tokens to their statuses', async () => {
    const table: Array<[string, number]> = [
      ['NOT_FOUND', 404],
      ['FORBIDDEN', 403],
      ['UNAUTHENTICATED', 401],
      ['INVALID_REQUEST', 400],
      ['IDEMPOTENCY_MISMATCH', 409],
      ['INVALID_TRANSITION', 409],
      ['CONFLICT', 409],
      ['RATE_LIMITED', 429],
    ];
    for (const [token, status] of table) {
      const result = await act((async () => raised(token)) as typeof fetch);
      expect(result, token).toMatchObject({ ok: false, status });
    }
  });

  it('carries the stale version pair of a version conflict', async () => {
    const result = await act((async () =>
      raised(
        'VERSION_MISMATCH',
        '{"expectedVersion":"1","currentVersion":"3"}',
      )) as typeof fetch);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: { expectedVersion: '1', currentVersion: '3' },
    });
  });

  it('treats a token of another operation, an unregistered raise and a provider fault as a scrubbed 500', async () => {
    const faults: Array<() => Response> = [
      () => raised('pattern_cycle'),
      () => raised('locale_limit_reached'),
      () => raised('not_a_registered_token'),
      () => raised('INTERNAL_ERROR'),
      () => json({ code: 'PGRST202', message: 'missing' }, 404),
      () => json({ code: '42702', message: 'ambiguous' }, 400),
      () => json('not an object', 400),
    ];
    for (const fault of faults) {
      const result = await act((async () => fault()) as typeof fetch);
      expect(result).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result)).not.toContain('PGRST202');
    }
  });

  it('maps provider outages and deadlines to 503 and 504', async () => {
    const outage = await act((async () =>
      json({ message: 'down' }, 503)) as typeof fetch);
    expect(outage).toMatchObject({ ok: false, status: 503 });
    const refused = await act((async () => {
      throw new Error('connect ECONNREFUSED');
    }) as typeof fetch);
    expect(refused).toMatchObject({ ok: false, status: 503 });
    const aborted = await act((async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch);
    expect(aborted).toMatchObject({ ok: false, status: 504 });
  });

  it('serves the whole route: a typed refusal reaches the browser as one uniform 422', async () => {
    const fetchImpl = vi.fn(async () =>
      raised('related_target_ineligible', '["/pins/0"]'),
    );
    const response = await createCmsRelatedContentApp(
      create(fetchImpl as typeof fetch),
    ).request(routeRequest());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_VALIDATION_FAILED',
      details: {
        reasonCode: 'related_target_ineligible',
        violations: [{ path: '/pins/0' }],
      },
    });
  });

  it('serves the whole route: a stored curation is a 201 with the new version as ETag', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const response = await createCmsRelatedContentApp(
      create(fetchImpl as typeof fetch),
    ).request(routeRequest());
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await response.json()).toMatchObject({
      id: entryId,
      eligibleCount: 9,
    });
  });

  it('has no implicit allow when production auth or rate dependencies are absent', async () => {
    // Injected refusing transport: the adapter must never reach the network in a unit test.
    const fetchImpl = vi.fn(async () => {
      throw new Error('no network');
    });
    const dependencies = createProductionCmsRelatedContentDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(dependencies.humanOrigins).toEqual([]);
    const result = await dependencies.actRelatedContent(portInput(), signal());
    expect(result).toMatchObject({ ok: false, status: 503 });
    const session = await dependencies.resolveSession(
      new Request(`https://api.example.test${path}`),
      signal(),
    );
    expect(session).toMatchObject({ ok: false, status: 503 });
  });
});
