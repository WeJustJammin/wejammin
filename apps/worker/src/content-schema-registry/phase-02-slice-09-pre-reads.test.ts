import { describe, expect, it } from 'vitest';

import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  USER_ID,
  VERSION_ID,
  HASH,
  block,
  detail,
  error,
  ok,
  resource,
  safeBlock,
  session,
} from './phase-02-slice-09-test-values';
import { makeHarness } from './phase-02-slice-09-worker-test-support';

type H = ReturnType<typeof makeHarness>;
const read = (
  path: string,
  headers: Record<string, string> = {},
  init: RequestInit = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    headers: {
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    ...init,
  });
const LIST = '/api/v1/cms/content-types';
const DETAIL = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const listPort = (h: H) => h.ports.listContentTypes;
const detailPort = (h: H) => h.ports.getContentTypeVersion;
type Body = {
  code: string;
  details: Record<string, unknown> & { violations?: { path?: string }[] };
};

const refusedList = async (
  query: string,
  status: 400 | 422,
  pathPrefix?: string,
): Promise<void> => {
  const harness = makeHarness();
  const response = await harness.app.request(read(`${LIST}${query}`));
  expect(response.status, query).toBe(status);
  const body = (await response.json()) as Body;
  expect(body.code).toBe(
    status === 400 ? 'INVALID_REQUEST' : 'VALIDATION_FAILED',
  );
  if (pathPrefix !== undefined)
    expect(
      (body.details.violations ?? []).some((v) =>
        (v.path ?? '').startsWith(pathPrefix),
      ),
    ).toBe(true);
  expect(listPort(harness)).not.toHaveBeenCalled();
};
const acceptedList = async (
  query: string,
): Promise<Record<string, unknown>> => {
  const harness = makeHarness();
  const response = await harness.app.request(read(`${LIST}${query}`));
  expect(response.status, query).toBe(200);
  expect(listPort(harness)).toHaveBeenCalledTimes(1);
  return (
    listPort(harness).mock.calls[0]?.[0] as { query: Record<string, unknown> }
  ).query;
};

describe('CMS-03A-06 protected list query through the real route', () => {
  it('[P2-S09-AC-124] rejects unknown, repeated and mutation-bearing query keys before authorization or any database access', async () => {
    for (const query of [
      `?ownerId=${USER_ID}`,
      '?capability=x',
      '?limit=5&limit=6',
      '?sort=key&sort=createdAt',
      '?includeRetired=true',
      '?q=drop',
    ]) {
      const harness = makeHarness();
      const response = await harness.app.request(read(`${LIST}${query}`));
      expect(response.status, query).toBe(400);
      expect(((await response.json()) as Body).code).toBe('INVALID_REQUEST');
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(listPort(harness)).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-125] accepts resourceKind only as one of the eight declared discriminators', async () => {
    const kinds = [
      'content_type',
      'content_type_version',
      'field_definition_version',
      'relation_definition',
      'schema_artifact',
      'block_definition_registry_record',
      'template_binding',
      'capability_binding',
    ];
    for (const resourceKind of kinds)
      expect(
        (await acceptedList(`?resourceKind=${resourceKind}`)).resourceKind,
      ).toBe(resourceKind);
    expect(Object.keys(await acceptedList(''))).not.toContain('resourceKind');
    for (const resourceKind of [
      'block_definition_version',
      'Content_Type',
      'content type',
      'all',
      '',
    ])
      await refusedList(
        `?resourceKind=${encodeURIComponent(resourceKind)}`,
        422,
        '/resourceKind',
      );
  });

  it('[P2-S09-AC-126] accepts keyPrefix only as a lowercase allowlisted prefix bounded to ^[a-z][a-z0-9._-]{0,63}$', async () => {
    for (const keyPrefix of ['a', 'article', 'a.b_c-d', `a${'b'.repeat(63)}`])
      expect((await acceptedList(`?keyPrefix=${keyPrefix}`)).keyPrefix).toBe(
        keyPrefix,
      );
    for (const keyPrefix of [
      '',
      'A',
      '1a',
      '_a',
      'a b',
      'a%27%20or%201=1',
      'a;b',
      `a${'b'.repeat(64)}`,
      '*',
      '%',
    ])
      await refusedList(`?keyPrefix=${keyPrefix}`, 422, '/keyPrefix');
  });

  it('[P2-S09-AC-127] [P2-S09-AC-128] [P2-S09-AC-129] keeps lifecycle and state two closed unions bound to the resourceKind they belong to', async () => {
    const lifecycle: Record<string, string[]> = {
      content_type: ['active', 'retired'],
      field_definition_version: ['active', 'deprecated', 'retired'],
      block_definition_registry_record: [
        'supported',
        'deprecated',
        'withdrawn',
      ],
    };
    const everyLifecycle = [
      'active',
      'retired',
      'deprecated',
      'supported',
      'withdrawn',
    ];
    for (const [kind, accepted] of Object.entries(lifecycle))
      for (const value of everyLifecycle) {
        if (accepted.includes(value))
          await acceptedList(`?resourceKind=${kind}&lifecycle=${value}`);
        else
          await refusedList(
            `?resourceKind=${kind}&lifecycle=${value}`,
            422,
            '/lifecycle',
          );
        await refusedList(`?resourceKind=${kind}&state=draft`, 422, '/state');
      }
    const stateOnly = [
      'content_type_version',
      'relation_definition',
      'schema_artifact',
      'template_binding',
      'capability_binding',
    ];
    const everyState = [
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
      'compiled',
    ];
    for (const kind of stateOnly) {
      for (const value of everyLifecycle)
        await refusedList(
          `?resourceKind=${kind}&lifecycle=${value}`,
          422,
          '/lifecycle',
        );
      for (const state of everyState)
        expect(
          (await acceptedList(`?resourceKind=${kind}&state=${state}`)).state,
        ).toBe(state);
    }
    for (const bad of [
      'supported',
      'withdrawn',
      'deprecated',
      'bogus',
      'DRAFT',
      '',
    ])
      await refusedList(`?state=${bad}`, 422, '/state');
    for (const bad of ['draft', 'bogus', 'ACTIVE', ''])
      await refusedList(`?lifecycle=${bad}`, 422, '/lifecycle');
    expect((await acceptedList('?lifecycle=supported')).lifecycle).toBe(
      'supported',
    );
    expect((await acceptedList('?state=draft')).state).toBe('draft');
  });

  it('[P2-S09-AC-130] hands an omitted-resourceKind lifecycle filter to the list RPC as a lifecycle filter and never as a state', async () => {
    const query = await acceptedList('?lifecycle=active');
    expect(query).toMatchObject({ lifecycle: 'active' });
    expect(query).not.toHaveProperty('state');
    expect(query).not.toHaveProperty('resourceKind');
    const both = await acceptedList('?lifecycle=active&state=draft');
    expect(both).toMatchObject({ lifecycle: 'active', state: 'draft' });
  });

  it('[P2-S09-AC-131] defaults limit to 25, bounds it to integers 1-100 and caps response items at 100', async () => {
    expect((await acceptedList('')).limit).toBe(25);
    for (const limit of ['1', '50', '100'])
      expect((await acceptedList(`?limit=${limit}`)).limit).toBe(Number(limit));
    for (const limit of ['0', '101', '-1', '1.5', 'ten', ''])
      await refusedList(`?limit=${limit}`, 422, '/limit');
    const harness = makeHarness();
    listPort(harness).mockResolvedValueOnce(
      ok({
        items: Array.from({ length: 100 }, () => safeBlock),
        nextCursor: null,
      }),
    );
    expect((await harness.app.request(read(LIST))).status).toBe(200);
    const over = makeHarness();
    listPort(over).mockResolvedValueOnce(
      ok({
        items: Array.from({ length: 101 }, () => safeBlock),
        nextCursor: null,
      }),
    );
    expect((await over.app.request(read(LIST))).status).toBe(502);
  });

  it('[P2-S09-AC-132] treats cursor as an opaque 1-512 character token passed through unmodified', async () => {
    for (const cursor of ['a', 'eyJrIjoiYSJ9', 'x'.repeat(512), 'a.b-c_d~e'])
      expect((await acceptedList(`?cursor=${cursor}`)).cursor).toBe(cursor);
    for (const cursor of ['', 'x'.repeat(513)])
      await refusedList(`?cursor=${cursor}`, 400);
    const harness = makeHarness();
    listPort(harness).mockResolvedValueOnce(
      ok({ items: [], nextCursor: 'x'.repeat(512) }),
    );
    expect(
      (
        (await (await harness.app.request(read(LIST))).json()) as {
          nextCursor: string;
        }
      ).nextCursor,
    ).toHaveLength(512);
    const long = makeHarness();
    listPort(long).mockResolvedValueOnce(
      ok({ items: [], nextCursor: 'x'.repeat(513) }),
    );
    expect((await long.app.request(read(LIST))).status).toBe(502);
  });

  it('[P2-S09-AC-133] accepts sort key, createdAt, updatedAt or version and direction asc or desc with key and asc as defaults', async () => {
    const defaults = await acceptedList('');
    expect(defaults).toMatchObject({ sort: 'key', direction: 'asc' });
    for (const sort of ['key', 'createdAt', 'updatedAt', 'version'])
      for (const direction of ['asc', 'desc'])
        expect(
          await acceptedList(`?sort=${sort}&direction=${direction}`),
        ).toMatchObject({ sort, direction });
    for (const sort of ['id', 'created_at', 'KEY', '', 'owner'])
      await refusedList(`?sort=${sort}`, 422, '/sort');
    for (const direction of ['ASC', 'up', '', 'descending'])
      await refusedList(`?direction=${direction}`, 422, '/direction');
  });

  it('[P2-S09-AC-134] returns 200 with a strict list page of discriminated registry records and a nullable nextCursor', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(read(LIST));
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      items: { resourceKind: string }[];
      nextCursor: string | null;
    };
    expect(Object.keys(page).sort()).toEqual(['items', 'nextCursor']);
    expect(page.items.map((item) => item.resourceKind)).toEqual([
      'content_type_version',
      'block_definition_registry_record',
    ]);
    expect(page.nextCursor).toBeNull();
    for (const bad of [
      { items: [], nextCursor: undefined },
      { items: [{ resourceKind: 'unknown' }], nextCursor: null },
      { items: [], nextCursor: null, total: 4 },
      { items: 'x', nextCursor: null },
      { items: [{ ...resource, extra: 1 }], nextCursor: null },
    ]) {
      const broken = makeHarness();
      listPort(broken).mockResolvedValueOnce(ok(bad));
      expect(
        (await broken.app.request(read(LIST))).status,
        JSON.stringify(bad).slice(0, 40),
      ).toBe(502);
    }
  });

  it('[P2-S09-AC-135] returns only capability-safe discriminated records and the block registry record rather than the full worker resource', async () => {
    for (const unsafe of [
      block,
      { ...safeBlock, ownerId: USER_ID },
      { ...safeBlock, releaseNonceHash: HASH },
      { ...safeBlock, propsSchemaSnapshot: {} },
      { ...resource, ownerId: USER_ID },
      { ...safeBlock, releaseKeyId: 'k' },
    ]) {
      const harness = makeHarness();
      listPort(harness).mockResolvedValueOnce(
        ok({ items: [unsafe], nextCursor: null }),
      );
      const response = await harness.app.request(read(LIST));
      expect(response.status, JSON.stringify(unsafe).slice(0, 50)).toBe(502);
      expect(await response.text()).not.toMatch(
        /ownerId|releaseNonceHash|propsSchemaSnapshot|releaseKeyId/u,
      );
    }
    const harness = makeHarness();
    const page = (await (await harness.app.request(read(LIST))).json()) as {
      items: Record<string, unknown>[];
    };
    const registryRecord = page.items.find(
      (item) => item.resourceKind === 'block_definition_registry_record',
    ) as Record<string, unknown>;
    expect(Object.keys(registryRecord).sort()).toEqual(
      Object.keys(safeBlock).sort(),
    );
  });

  it('[P2-S09-AC-136] requires an authenticated session with registry-read or schema-designer capability', async () => {
    const anonymous = makeHarness({
      session: error(401, 'UNAUTHENTICATED', 'Sign in', {
        recoveryAction: 'reauthenticate',
      }),
    });
    const unauth = await anonymous.app.request(read(LIST));
    expect(unauth.status).toBe(401);
    for (const capabilities of [
      ['cms.schema_registry.read'],
      ['cms.schema_designer'],
    ]) {
      const harness = makeHarness({
        session: ok({ ...session, capabilities }),
      });
      expect(
        (await harness.app.request(read(LIST))).status,
        capabilities.join(),
      ).toBe(200);
    }
    for (const capabilities of [
      [],
      ['cms.schema_review'],
      ['release.block_registry.write'],
      ['cms.content.article'],
    ]) {
      const harness = makeHarness({
        session: ok({ ...session, capabilities }),
      });
      const response = await harness.app.request(read(LIST));
      expect(response.status, capabilities.join()).toBe(403);
      expect(((await response.json()) as Body).details.reasonCode).toBe(
        'CAPABILITY_REQUIRED',
      );
      expect(listPort(harness)).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-137] [P2-S09-AC-146] sends Cache-Control no-store on the list and the detail and on every refusal', async () => {
    for (const path of [LIST, DETAIL]) {
      const harness = makeHarness();
      expect(
        (await harness.app.request(read(path))).headers.get('cache-control'),
      ).toBe('no-store');
      const refused = makeHarness({
        session: ok({ ...session, capabilities: [] }),
      });
      expect(
        (await refused.app.request(read(path))).headers.get('cache-control'),
      ).toBe('no-store');
      const failing = makeHarness();
      (path === LIST
        ? listPort(failing)
        : detailPort(failing)
      ).mockResolvedValueOnce(error(503, 'DEPENDENCY_UNAVAILABLE'));
      expect(
        (await failing.app.request(read(path))).headers.get('cache-control'),
      ).toBe('no-store');
    }
  });

  it('[P2-S09-AC-138] [P2-S09-AC-280] rejects Idempotency-Key, If-Match and request bodies on the protected reads and touches only the one read RPC, the limiter and telemetry', async () => {
    for (const path of [LIST, DETAIL]) {
      for (const headers of [
        { 'idempotency-key': 'read-should-fail' },
        { 'if-match': '"1"' },
      ]) {
        const harness = makeHarness();
        const response = await harness.app.request(read(path, headers));
        expect(response.status).toBe(400);
        expect(harness.rateLimit).not.toHaveBeenCalled();
        expect(listPort(harness)).not.toHaveBeenCalled();
        expect(detailPort(harness)).not.toHaveBeenCalled();
      }
      const bodiedGet = makeHarness();
      const bodied = await bodiedGet.app.request(
        read(path, { 'content-length': '2' }),
      );
      expect(bodied.status).toBe(400);
      expect(listPort(bodiedGet)).not.toHaveBeenCalled();
    }
    const harness = makeHarness();
    expect((await harness.app.request(read(LIST))).status).toBe(200);
    const writers = Object.entries(harness.ports).filter(
      ([name]) => name !== 'listContentTypes',
    );
    for (const [, port] of writers) expect(port).not.toHaveBeenCalled();
    expect(listPort(harness)).toHaveBeenCalledTimes(1);
    expect(harness.rateLimit).toHaveBeenCalledTimes(1);
    expect(harness.telemetry).toHaveBeenCalledTimes(1);
    const input = listPort(harness).mock.calls[0]?.[0] as {
      idempotencyKey?: string;
      ifMatch?: string;
      body?: unknown;
    };
    expect([input.idempotencyKey, input.ifMatch, input.body]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('CMS-03A-07 protected detail through the real route', () => {
  it('[P2-S09-AC-139] accepts only strict contentTypeId and versionId UUID path parameters and never a label', async () => {
    const harness = makeHarness();
    expect((await harness.app.request(read(DETAIL))).status).toBe(200);
    const input = detailPort(harness).mock.calls[0]?.[0] as {
      path: Record<string, string>;
    };
    expect(input.path).toEqual({
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    });
    for (const [type, version] of [
      ['article', VERSION_ID],
      [TYPE_ID, 'v1'],
      [TYPE_ID, '1'],
      ['Article', 'Draft'],
      [`${TYPE_ID}x`, VERSION_ID],
      [TYPE_ID, ''],
    ]) {
      const refused = makeHarness();
      const response = await refused.app.request(
        read(`/api/v1/cms/content-types/${type}/versions/${version}`),
      );
      // A non-empty malformed segment is 400; an empty one names no registered
      // route, so it is the router's 404.
      expect(response.status, `${type}/${version}`).toBe(
        version === '' ? 404 : 400,
      );
      expect(detailPort(refused)).not.toHaveBeenCalled();
    }
    const malformed = await makeHarness().app.request(
      read(`/api/v1/cms/content-types/article/versions/${VERSION_ID}`),
    );
    expect(malformed.status).toBe(400);
  });

  it('[P2-S09-AC-140] rejects query strings and bodies, refuses Idempotency-Key and If-Match and does not require a Content-Type', async () => {
    for (const query of [
      '?x=1',
      '?includeArtifact=false',
      '?limit=5',
      '?contentTypeId=x',
    ]) {
      const harness = makeHarness();
      const response = await harness.app.request(read(`${DETAIL}${query}`));
      expect(response.status, query).toBe(400);
      expect(detailPort(harness)).not.toHaveBeenCalled();
    }
    for (const headers of [
      { 'idempotency-key': 'abcdefgh' },
      { 'if-match': '"1"' },
      { 'content-length': '2' },
    ]) {
      const harness = makeHarness();
      expect((await harness.app.request(read(DETAIL, headers))).status).toBe(
        400,
      );
      expect(detailPort(harness)).not.toHaveBeenCalled();
    }
    const harness = makeHarness();
    const request = read(DETAIL);
    expect(request.headers.get('content-type')).toBeNull();
    expect((await harness.app.request(request)).status).toBe(200);
  });

  it('[P2-S09-AC-141] requires an authenticated registry-read or schema-designer session and hands the verified acting context to the RPC', async () => {
    const anonymous = makeHarness({ session: error(401, 'UNAUTHENTICATED') });
    expect((await anonymous.app.request(read(DETAIL))).status).toBe(401);
    for (const capabilities of [
      ['cms.schema_registry.read'],
      ['cms.schema_designer'],
    ])
      expect(
        (
          await makeHarness({
            session: ok({ ...session, capabilities }),
          }).app.request(read(DETAIL))
        ).status,
      ).toBe(200);
    const none = makeHarness({
      session: ok({ ...session, capabilities: ['cms.schema_review'] }),
    });
    expect((await none.app.request(read(DETAIL))).status).toBe(403);
    expect(detailPort(none)).not.toHaveBeenCalled();
    const harness = makeHarness();
    await harness.app.request(
      read(DETAIL, { 'x-acting-party-id': 'forged', 'x-actor-id': 'forged' }),
    );
    const input = detailPort(harness).mock.calls[0]?.[0] as {
      session: { userId: string; actingPartyId: string };
    };
    expect([input.session.userId, input.session.actingPartyId]).toEqual([
      session.userId,
      session.actingPartyId,
    ]);
  });

  it('[P2-S09-AC-142] answers 403 for a readable parent without the detail capability and a concealed 404 for a hidden, absent or mismatched type or version', async () => {
    const forbidden = makeHarness();
    detailPort(forbidden).mockResolvedValueOnce(
      error(403, 'FORBIDDEN', 'lacks detail capability', {
        reasonCode: 'CAPABILITY_REQUIRED',
      }),
    );
    const r403 = await forbidden.app.request(read(DETAIL));
    expect(r403.status).toBe(403);
    expect(((await r403.json()) as Body).details).toEqual({
      reasonCode: 'CAPABILITY_REQUIRED',
    });
    const bodies: string[] = [];
    for (const reason of ['hidden', 'absent', 'mismatched']) {
      const harness = makeHarness();
      detailPort(harness).mockResolvedValueOnce(
        error(404, 'NOT_FOUND', reason, { ownerId: USER_ID, reason }),
      );
      const response = await harness.app.request(read(DETAIL));
      expect(response.status).toBe(404);
      bodies.push(await response.text());
    }
    expect(
      new Set(bodies.map((body) => body.replace(/"message":"[^"]*"/u, '')))
        .size,
    ).toBe(1);
    expect(bodies.join()).not.toMatch(/hidden|absent|mismatched|ownerId/u);
  });

  it('[P2-S09-AC-144] always includes the capability-safe SchemaArtifact identity and hash and offers no way to omit it', async () => {
    const harness = makeHarness();
    const body = (await (await harness.app.request(read(DETAIL))).json()) as {
      schemaArtifact: { id: string; artifactHash: string };
    };
    expect(body.schemaArtifact.id).toBeDefined();
    expect(body.schemaArtifact.artifactHash).toMatch(/^[a-f0-9]{64}$/u);
    const missing = makeHarness();
    const withoutArtifact = Object.fromEntries(
      Object.entries(detail).filter(([key]) => key !== 'schemaArtifact'),
    );
    detailPort(missing).mockResolvedValueOnce(ok(withoutArtifact));
    expect((await missing.app.request(read(DETAIL))).status).toBe(502);
    const nullArtifact = makeHarness();
    detailPort(nullArtifact).mockResolvedValueOnce(
      ok({ ...detail, schemaArtifact: null }),
    );
    expect((await nullArtifact.app.request(read(DETAIL))).status).toBe(502);
    for (const flag of [
      '?includeArtifact=false',
      '?omitArtifact=1',
      '?fields=resource',
    ])
      expect(
        (await makeHarness().app.request(read(`${DETAIL}${flag}`))).status,
      ).toBe(400);
  });

  it('[P2-S09-AC-145] projects only safe block registry record fields and excludes the snapshot, attestation, release evidence, timestamps, source and executable evidence', async () => {
    const forbidden = {
      propsSchemaSnapshot: {},
      propsSnapshotAttestation: {},
      releaseKeyId: 'k',
      releaseRawBodyHash: HASH,
      releaseSignatureHash: HASH,
      releaseNonceHash: HASH,
      releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
      rendererSource: 'x',
      source: 'x',
      script: 'x',
      ownerId: USER_ID,
    };
    for (const [member, value] of Object.entries(forbidden)) {
      const harness = makeHarness();
      detailPort(harness).mockResolvedValueOnce(
        ok({
          ...detail,
          blockDefinitions: [{ ...safeBlock, [member]: value }],
        }),
      );
      const response = await harness.app.request(read(DETAIL));
      expect(response.status, member).toBe(502);
      expect(await response.text()).not.toContain(
        member === 'releaseVerifiedAt'
          ? '2026-09-02T12:00:00.000Z'
          : `"${member}"`,
      );
    }
    const harness = makeHarness();
    const body = (await (await harness.app.request(read(DETAIL))).json()) as {
      blockDefinitions: Record<string, unknown>[];
    };
    expect(Object.keys(body.blockDefinitions[0] as object).sort()).toEqual(
      Object.keys(safeBlock).sort(),
    );
  });

  it('[P2-S09-AC-147] performs exactly one read RPC with no idempotency, version, body or write on success or failure', async () => {
    for (const result of [
      undefined,
      error(404, 'NOT_FOUND'),
      error(503, 'DEPENDENCY_UNAVAILABLE'),
      error(500, 'INTERNAL_ERROR'),
    ]) {
      const harness = makeHarness();
      if (result !== undefined)
        detailPort(harness).mockResolvedValueOnce(result);
      await harness.app.request(read(DETAIL));
      expect(detailPort(harness)).toHaveBeenCalledTimes(1);
      for (const [name, port] of Object.entries(harness.ports))
        if (name !== 'getContentTypeVersion')
          expect(port, name).not.toHaveBeenCalled();
      const input = detailPort(harness).mock.calls[0]?.[0] as {
        idempotencyKey?: string;
        ifMatch?: string;
        body?: unknown;
      };
      expect([input.idempotencyKey, input.ifMatch, input.body]).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    }
  });

  it('[P2-S09-AC-148] maps invalid-response, unavailable, deadline and internal dependency failures to safe declared errors without a hidden existence or capability graph', async () => {
    const cases: [number, string][] = [
      [502, 'DEPENDENCY_UNAVAILABLE'],
      [503, 'DEPENDENCY_UNAVAILABLE'],
      [504, 'DEPENDENCY_UNAVAILABLE'],
      [500, 'INTERNAL_ERROR'],
    ];
    for (const [status, code] of cases) {
      const harness = makeHarness();
      detailPort(harness).mockResolvedValueOnce(
        error(
          status as 500,
          code,
          'relation cms_content_types does not exist',
          {
            capabilityGraph: ['cms.a', 'cms.b'],
            ownerId: USER_ID,
            hiddenParentExists: true,
          },
        ),
      );
      const response = await harness.app.request(read(DETAIL));
      expect(response.status).toBe(status);
      const text = await response.text();
      expect((JSON.parse(text) as Body).code).toBe(code);
      expect(text).not.toMatch(
        /cms_content_types|capabilityGraph|ownerId|hiddenParentExists|cms\.a/u,
      );
    }
    const crashing = makeHarness();
    detailPort(crashing).mockRejectedValueOnce(
      new Error('connection reset by peer 10.0.0.4'),
    );
    const response = await crashing.app.request(read(DETAIL));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('10.0.0.4');
    const invalid = makeHarness();
    detailPort(invalid).mockResolvedValueOnce(
      ok({ resourceKind: 'content_type_version' }),
    );
    expect((await invalid.app.request(read(DETAIL))).status).toBe(502);
  });
});

const failureMatrix = async (
  path: string,
  portOf: (h: H) => H['ports'][keyof H['ports']],
  extra: readonly [string, number, string][],
): Promise<void> => {
  const check = async (
    harness: H,
    request: Request,
    status: number,
    code: string,
    readCalls: number,
  ) => {
    const response = await harness.app.request(request);
    const text = await response.text();
    expect([response.status, (JSON.parse(text) as Body).code], code).toEqual([
      status,
      code,
    ]);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(text).not.toMatch(/SQLSTATE|stack|ownerId/u);
    expect(portOf(harness)).toHaveBeenCalledTimes(readCalls);
    for (const [name, port] of Object.entries(harness.ports))
      if (port !== portOf(harness)) expect(port, name).not.toHaveBeenCalled();
  };
  // Before the RPC: malformed request, missing session, missing capability, rate limit.
  await check(
    makeHarness(),
    read(path, { 'idempotency-key': 'read-should-fail' }),
    400,
    'INVALID_REQUEST',
    0,
  );
  await check(
    makeHarness({
      session: error(401, 'UNAUTHENTICATED', 'Sign in', {
        recoveryAction: 'reauthenticate',
      }),
    }),
    read(path),
    401,
    'UNAUTHENTICATED',
    0,
  );
  await check(
    makeHarness({ session: ok({ ...session, capabilities: [] }) }),
    read(path),
    403,
    'FORBIDDEN',
    0,
  );
  await check(
    makeHarness({
      rate: ok({
        allowed: false,
        limit: 120,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    }),
    read(path),
    429,
    'RATE_LIMITED',
    0,
  );
  for (const [query, status, code] of extra) {
    const harness = makeHarness();
    await check(harness, read(`${path}${query}`), status, code, 0);
  }
  // After the RPC: the dependency and internal outcomes.
  for (const status of [502, 503, 504] as const) {
    const harness = makeHarness();
    portOf(harness).mockResolvedValueOnce(
      error(status, 'DEPENDENCY_UNAVAILABLE'),
    );
    await check(harness, read(path), status, 'DEPENDENCY_UNAVAILABLE', 1);
  }
  const crashing = makeHarness();
  portOf(crashing).mockRejectedValueOnce(
    new Error('SQLSTATE 57014 statement timeout'),
  );
  await check(crashing, read(path), 500, 'INTERNAL_ERROR', 1);
  const invalid = makeHarness();
  portOf(invalid).mockResolvedValueOnce(ok({ unexpected: true }));
  await check(invalid, read(path), 502, 'DEPENDENCY_UNAVAILABLE', 1);
};

describe('BE03a protected read error coverage', () => {
  it('[P2-S09-AC-198] maps every A06 failure (malformed query or cursor, UNAUTHENTICATED, FORBIDDEN, VALIDATION_FAILED, RATE_LIMITED, dependency and internal) safely without registry mutation', async () => {
    await failureMatrix(LIST, listPort, [
      ['?cursor=', 400, 'INVALID_REQUEST'],
      ['?ownerId=x', 400, 'INVALID_REQUEST'],
      ['?limit=101', 422, 'VALIDATION_FAILED'],
      ['?resourceKind=bogus', 422, 'VALIDATION_FAILED'],
    ]);
  });

  it('[P2-S09-AC-199] maps every A07 failure (malformed UUID or header, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, dependency and internal) safely without registry mutation', async () => {
    await failureMatrix(DETAIL, detailPort, [['?x=1', 400, 'INVALID_REQUEST']]);
    const malformed = makeHarness();
    const response = await malformed.app.request(
      read(`/api/v1/cms/content-types/nope/versions/${VERSION_ID}`),
    );
    expect(response.status).toBe(400);
    expect(detailPort(malformed)).not.toHaveBeenCalled();
    const hidden = makeHarness();
    detailPort(hidden).mockResolvedValueOnce(
      error(404, 'NOT_FOUND', 'absent', { ownerId: USER_ID }),
    );
    const notFound = await hidden.app.request(read(DETAIL));
    expect([notFound.status, ((await notFound.json()) as Body).code]).toEqual([
      404,
      'NOT_FOUND',
    ]);
    expect(detailPort(hidden)).toHaveBeenCalledTimes(1);
  });
});
