import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { productionPorts } from './phase-02-slice-09-pre-release-production';
import {
  releaseHttp,
  makeSignedHarness,
  makeSigning,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import {
  HUMAN_CASES,
  bodyOf,
  sendHuman,
} from './phase-02-slice-09-pre-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  FIELD_ID,
  REQUEST_ID,
  USER_ID,
  error,
  ok,
  session,
  validActivation,
  validBlock,
  validDraft,
  validField,
  validLifecycle,
  validRelation,
} from './phase-02-slice-09-test-values';
import {
  jsonRequest,
  makeHarness,
  mutationPath,
} from './phase-02-slice-09-worker-test-support';

let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning();
});
const BODIES = {
  'CMS-03A-01': validDraft,
  'CMS-03A-02': validField,
  'CMS-03A-03': validRelation,
  'CMS-03A-04': validActivation,
} as const;
const nested = (levels: number): unknown =>
  levels === 0 ? 1 : { a: nested(levels - 1) };
const withDefault = (defaultValue: unknown) => ({
  ...validField,
  defaultMode: 'literal',
  defaultValue,
});

describe('A01-A08 request guards run before authorization', () => {
  it('[P2-S09-AC-020] runs request-id, media, query guards and strict parsing before the session, capability or limiter and never authorizes an unparsed body', async () => {
    const anonymous = (overrides = {}) =>
      makeHarness({ session: error(401, 'UNAUTHENTICATED'), ...overrides });
    const invalid = anonymous();
    expect(
      (
        await sendHuman(invalid, 'CMS-03A-01', {
          ...validDraft,
          typeKey: 'Bad Key',
        })
      ).status,
    ).toBe(422);
    const media = anonymous();
    expect(
      (
        await sendHuman(media, 'CMS-03A-01', validDraft, {
          'content-type': 'text/plain',
        })
      ).status,
    ).toBe(415);
    const broken = anonymous();
    const response = await broken.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'POST',
        headers: {
          origin: CMS_ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': 'cms-test-key-001',
        },
        body: '{"typeKey":',
      }),
    );
    expect(response.status).toBe(400);
    const query = anonymous();
    expect(
      (
        await query.app.request(
          new Request(`${API_ORIGIN}/api/v1/cms/content-types?bogus=1`, {
            headers: { origin: CMS_ORIGIN, authorization: 'Bearer x' },
          }),
        )
      ).status,
    ).toBe(400);
    for (const harness of [invalid, media, broken, query]) {
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(harness.rateLimit).not.toHaveBeenCalled();
    }
    const echoed = makeHarness();
    expect(
      (await sendHuman(echoed, 'CMS-03A-01', validDraft)).headers.get(
        'x-request-id',
      ),
    ).toBe(REQUEST_ID);
    const forged = makeHarness();
    const generated = await forged.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft, {
        'x-request-id': 'not a uuid; drop table',
      }),
    );
    expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/u);
    expect(generated.headers.get('x-request-id')).not.toContain('drop');
    for (const spec of HUMAN_CASES) {
      const harness = makeHarness({
        session: ok({ ...session, capabilities: [] }),
      });
      const refused = await sendHuman(harness, spec.operationId, {
        ...(BODIES[spec.operationId] as object),
        unknown: 1,
      });
      expect(refused.status, spec.operationId).toBe(422);
      expect(harness.ports[spec.port]).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-021] enforces the 256 KiB raw ceiling, JSON depth 8, 128 keys and 128 array items before any port call', async () => {
    const limit = 256 * 1024;
    const json = JSON.stringify(validDraft);
    const padded = (size: number) => json + ' '.repeat(size - json.length);
    const send = (raw: string, headers: Record<string, string> = {}) =>
      makeHarness().app.request(
        new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
          method: 'POST',
          headers: {
            origin: CMS_ORIGIN,
            authorization: 'Bearer x',
            'content-type': 'application/json',
            'idempotency-key': 'cms-test-key-001',
            'x-request-id': REQUEST_ID,
            ...headers,
          },
          body: raw,
        }),
      );
    expect((await send(padded(limit))).status).toBe(201);
    expect((await send(padded(limit + 1))).status).toBe(413);
    const streamed = new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
      method: 'POST',
      headers: {
        origin: CMS_ORIGIN,
        authorization: 'Bearer x',
        'content-type': 'application/json',
        'idempotency-key': 'cms-test-key-001',
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(padded(limit + 1)));
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);
    expect((await makeHarness().app.request(streamed)).status).toBe(413);
    const harness = makeHarness();
    const huge = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft, {
        'content-length': String(limit + 1),
      }),
    );
    expect(huge.status).toBe(413);
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    const deep = makeHarness();
    for (const [levels, status] of [
      [8, 201],
      [9, 422],
    ] as const) {
      const res = await sendHuman(
        deep,
        'CMS-03A-02',
        withDefault(nested(levels)),
        { 'if-match': '"1"' },
      );
      expect(res.status, `depth ${levels}`).toBe(status);
    }
    const keys = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, i]));
    expect(
      (await sendHuman(makeHarness(), 'CMS-03A-02', withDefault(keys(128))))
        .status,
    ).toBe(201);
    expect(
      (await sendHuman(makeHarness(), 'CMS-03A-02', withDefault(keys(129))))
        .status,
    ).toBe(422);
    expect(
      (
        await sendHuman(
          makeHarness(),
          'CMS-03A-02',
          withDefault(Array.from({ length: 128 }, () => 0)),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await sendHuman(
          makeHarness(),
          'CMS-03A-02',
          withDefault(Array.from({ length: 129 }, () => 0)),
        )
      ).status,
    ).toBe(422);
  });

  it('[P2-S09-AC-022] requires Idempotency-Key of 8-128 printable ASCII on every original mutation and refuses a missing, malformed or aliased key', async () => {
    for (const spec of HUMAN_CASES) {
      const accepted = async (key: string) =>
        (
          await sendHuman(
            makeHarness(),
            spec.operationId,
            BODIES[spec.operationId],
            { 'idempotency-key': key },
          )
        ).status;
      expect(await accepted('abcdefgh')).toBeLessThan(300);
      expect(await accepted('a'.repeat(128))).toBeLessThan(300);
      expect(
        await accepted(
          '~ !"#$%&\'()*+,-./09:;<=>?@AZ[\\]^_`az{|}~'.slice(0, 40),
        ),
      ).toBeLessThan(300);
      for (const key of [
        '',
        'abcdefg',
        'a'.repeat(129),
        'abc\tdefgh',
        'café-key-1',
        'abcdefg\u007f',
      ])
        expect(
          await accepted(key),
          `${spec.operationId} ${JSON.stringify(key)}`,
        ).toBe(400);
      const harness = makeHarness();
      const aliased = new Request(`${API_ORIGIN}${spec.path}`, {
        method: 'POST',
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer x',
          'content-type': 'application/json',
          'x-idempotency-key': 'cms-alias-key-001',
          idempotency_key: 'cms-alias-key-002',
          ...(spec.ifMatch ? { 'if-match': '"1"' } : {}),
        },
        body: JSON.stringify(BODIES[spec.operationId]),
      });
      expect((await harness.app.request(aliased)).status).toBe(400);
      expect(harness.ports[spec.port]).not.toHaveBeenCalled();
    }
    for (const operationId of ['CMS-03A-05', 'CMS-03A-08'] as const) {
      const body = operationId === 'CMS-03A-05' ? validBlock : validLifecycle;
      const harness = await makeSignedHarness({ signing });
      const raw = JSON.stringify(body);
      const headers = await signing.sign(operationId, raw);
      for (const key of ['', 'short', 'a'.repeat(129), 'abc\tdefgh'])
        expect(
          (
            await harness.app.request(
              releaseHttp(operationId, raw, headers, {
                'idempotency-key': key,
              }),
            )
          ).status,
          `${operationId} ${JSON.stringify(key)}`,
        ).toBe(400);
      const missing = releaseHttp(operationId, raw, headers);
      missing.headers.delete('idempotency-key');
      expect((await harness.app.request(missing)).status).toBe(400);
      expect(
        (
          await harness.app.request(
            releaseHttp(operationId, raw, headers, {
              'idempotency-key': 'abcdefgh',
            }),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await harness.app.request(
            releaseHttp(operationId, raw, headers, {
              'idempotency-key': 'a'.repeat(128),
            }),
          )
        ).status,
      ).toBe(201);
    }
  });

  it('[P2-S09-AC-023] requires an exact quoted positive-decimal If-Match on A02, A03, A04 and A08 and accepts none on A01, A05 and the reads', async () => {
    for (const spec of HUMAN_CASES.filter((candidate) => candidate.ifMatch)) {
      for (const header of ['"1"', '"42"', '"9223372036854775807"'])
        expect(
          (
            await sendHuman(
              makeHarness(),
              spec.operationId,
              spec.operationId === 'CMS-03A-04'
                ? { ...validActivation, expectedVersion: header.slice(1, -1) }
                : BODIES[spec.operationId],
              { 'if-match': header },
            )
          ).status,
          `${spec.operationId} ${header}`,
        ).toBeLessThan(300);
      for (const header of [
        '1',
        'W/"1"',
        '"0"',
        '"01"',
        '"-1"',
        '""',
        '"1.5"',
        '"a"',
        '"9223372036854775808"',
        '*',
        '"1", "2"',
      ])
        expect(
          (
            await sendHuman(
              makeHarness(),
              spec.operationId,
              BODIES[spec.operationId],
              { 'if-match': header },
            )
          ).status,
          `${spec.operationId} ${header}`,
        ).toBe(400);
    }
    const a01 = makeHarness();
    expect(
      (await sendHuman(a01, 'CMS-03A-01', validDraft, { 'if-match': '"1"' }))
        .status,
    ).toBe(400);
    expect(a01.ports.createTypeDraft).not.toHaveBeenCalled();
    const signed = await makeSignedHarness({ signing });
    expect(
      (
        await signed.send('CMS-03A-05', validBlock, {
          extra: { 'if-match': '"1"' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await signed.send('CMS-03A-08', validLifecycle, {
          extra: { 'if-match': 'W/"1"' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await signed.send('CMS-03A-08', validLifecycle, {
          extra: { 'if-match': '"1"' },
        })
      ).status,
    ).toBe(201);
    for (const path of [
      '/api/v1/cms/content-types',
      `/api/v1/cms/content-types/${FIELD_ID}/versions/${FIELD_ID}`,
    ]) {
      const harness = makeHarness();
      expect(
        (
          await harness.app.request(
            new Request(`${API_ORIGIN}${path}`, {
              headers: {
                origin: CMS_ORIGIN,
                authorization: 'Bearer x',
                'if-match': '"1"',
              },
            }),
          )
        ).status,
      ).toBe(400);
    }
  });

  it('[P2-S09-AC-024] hands every retry to the RPC with the key, actor, path, version and digest it carries and keeps no Worker replay cache', async () => {
    const harness = makeHarness();
    const sends = [
      jsonRequest(mutationPath.field, validField, { 'if-match': '"1"' }),
      jsonRequest(mutationPath.field, validField, { 'if-match': '"1"' }),
      jsonRequest(
        mutationPath.field,
        { ...validField, required: false },
        { 'if-match': '"1"' },
      ),
      jsonRequest(mutationPath.field, validField, { 'if-match': '"2"' }),
      jsonRequest(
        mutationPath.field.replace('40000000', '40000001'),
        validField,
        { 'if-match': '"1"' },
      ),
    ];
    for (const request of sends)
      expect((await harness.app.request(request)).status).toBe(201);
    expect(harness.ports.addFieldDefinition).toHaveBeenCalledTimes(5);
    const inputs = harness.ports.addFieldDefinition.mock.calls.map(
      (call) =>
        call[0] as {
          idempotencyKey: string;
          body: unknown;
          ifMatch: string;
          path: Record<string, string>;
          session: { userId: string };
        },
    );
    expect(new Set(inputs.map((input) => input.idempotencyKey))).toEqual(
      new Set(['cms-test-key-001']),
    );
    expect(JSON.stringify(inputs[0]?.body)).toBe(
      JSON.stringify(inputs[1]?.body),
    );
    expect(JSON.stringify(inputs[2]?.body)).not.toBe(
      JSON.stringify(inputs[0]?.body),
    );
    expect(inputs[3]?.ifMatch).not.toBe(inputs[0]?.ifMatch);
    expect(inputs[4]?.path.versionId).not.toBe(inputs[0]?.path.versionId);
    const otherActor = makeHarness({
      session: ok({
        ...session,
        userId: '10000000-0000-4000-8000-0000000000aa',
      }),
    });
    await otherActor.app.request(
      jsonRequest(mutationPath.field, validField, { 'if-match': '"1"' }),
    );
    expect(
      (
        otherActor.ports.addFieldDefinition.mock.calls[0]?.[0] as {
          session: { userId: string };
        }
      ).session.userId,
    ).not.toBe(inputs[0]?.session.userId);
    const signed = await makeSignedHarness({ signing });
    await signed.send('CMS-03A-08', validLifecycle);
    await signed.send('CMS-03A-08', {
      ...validLifecycle,
      releaseDigest: 'cd'.repeat(32),
    });
    const digests = signed.advanceBlockLifecycle.mock.calls.map(
      (call) =>
        (call[0] as { body: { releaseDigest: string } }).body.releaseDigest,
    );
    expect(new Set(digests).size).toBe(2);
    expect(USER_ID).toBeDefined();
  });

  it('[P2-S09-AC-036] derives actor, acting party, ownership and capability server-side and refuses caller-supplied authority in headers, query and body', async () => {
    const forged = {
      'x-actor-id': 'x',
      'x-acting-party-id': 'x',
      'x-owner-id': 'x',
      'x-capability': 'cms.schema_designer',
      'x-role': 'admin',
      'x-capabilities': 'cms.schema_designer',
    };
    for (const spec of HUMAN_CASES) {
      const harness = makeHarness({
        session: ok({ ...session, capabilities: [] }),
      });
      expect(
        (
          await sendHuman(
            harness,
            spec.operationId,
            BODIES[spec.operationId],
            forged,
          )
        ).status,
        spec.operationId,
      ).toBe(403);
      expect(harness.ports[spec.port]).not.toHaveBeenCalled();
      const ordinary = makeHarness();
      await sendHuman(
        ordinary,
        spec.operationId,
        BODIES[spec.operationId],
        forged,
      );
      const input = ordinary.ports[spec.port].mock.calls[0]?.[0] as {
        session: typeof session;
        request: Request;
      };
      expect([
        input.session.userId,
        input.session.actingPartyId,
        input.session.capabilities,
      ]).toEqual([session.userId, session.actingPartyId, session.capabilities]);
      for (const member of [
        'ownerId',
        'actorId',
        'actingPartyId',
        'capabilities',
        'createdBy',
        'authUserId',
      ]) {
        const refused = makeHarness();
        expect(
          (
            await sendHuman(refused, spec.operationId, {
              ...(BODIES[spec.operationId] as object),
              [member]: 'x',
            })
          ).status,
          `${spec.operationId} ${member}`,
        ).toBe(422);
        expect(refused.ports[spec.port]).not.toHaveBeenCalled();
      }
    }
    const read = makeHarness();
    expect(
      (
        await read.app.request(
          new Request(
            `${API_ORIGIN}/api/v1/cms/content-types?ownerId=x&actingPartyId=y`,
            { headers: { origin: CMS_ORIGIN, authorization: 'Bearer x' } },
          ),
        )
      ).status,
    ).toBe(400);
    const signed = await makeSignedHarness({ signing });
    expect(
      (
        await signed.send('CMS-03A-05', validBlock, {
          extra: {
            'x-release-principal': 'forged',
            'x-release-capability': 'release.block_registry.write',
          },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await signed.send('CMS-03A-05', {
          ...validBlock,
          releasePrincipalId: 'forged',
        })
      ).status,
    ).toBe(422);
  });
});

describe('persistence reaches the database only through named RPCs', () => {
  const recording = () => {
    const calls: {
      url: string;
      method: string;
      headers: Record<string, string>;
    }[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      calls.push({
        url: String(url),
        method: String(init?.method),
        headers: init?.headers as Record<string, string>,
      });
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return { calls, fetchImpl };
  };
  const input = (operationId: string) => ({
    operationId,
    requestId: REQUEST_ID,
    request: new Request(`${API_ORIGIN}/x`),
    session,
    body: {},
    path: {},
    idempotencyKey: 'abcdefgh',
  });

  it('[P2-S09-AC-037] sends every operation to one schema-qualified cms_* RPC in the platform_api profile and never to a table path', async () => {
    const { calls, fetchImpl } = recording();
    const ports = productionPorts(fetchImpl, () =>
      Date.now(),
    ) as unknown as Record<
      string,
      (input: unknown, signal: AbortSignal) => Promise<unknown>
    >;
    const expected = {
      createTypeDraft: 'cms_create_type_draft',
      addFieldDefinition: 'cms_add_field_definition',
      bindRelation: 'cms_bind_relation',
      activateSchema: 'cms_activate_schema',
      registerBlock: 'cms_register_block',
      listContentTypes: 'cms_list_content_types',
      getContentTypeVersion: 'cms_get_content_type_version',
      advanceBlockLifecycle: 'cms_advance_block_lifecycle',
    };
    for (const [port, rpc] of Object.entries(expected)) {
      calls.length = 0;
      await ports[port]?.(input('CMS-03A-01'), new AbortController().signal);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(
        `https://supabase.example.test/rest/v1/rpc/${rpc}`,
      );
      expect(calls[0]?.method).toBe('POST');
      expect(calls[0]?.headers['Content-Profile']).toBe('platform_api');
      expect(calls[0]?.headers['Accept-Profile']).toBe('platform_api');
      expect(calls[0]?.url).not.toMatch(/\/rest\/v1\/(?!rpc\/)/u);
    }
    expect(Object.keys(ports).length).toBeGreaterThanOrEqual(8);
  });

  it('[P2-S09-AC-038] admits no remote compiler or registry adapter: persistence is the single RPC seam, responses are Zod-validated and failures map to 502, 503 and 504', async () => {
    const dir = new URL('.', import.meta.url).pathname;
    // Compilation, registry resolution, admission, routing and release verification are in-process:
    // none of those modules performs an outbound call.
    const inProcess = readdirSync(dir).filter(
      (name) =>
        /^(admission|domain|runtime-port|route-|routes\.ts|release-|error-detail|contracts)/u.test(
          name,
        ) && !/\.test\.ts$|-support\.ts$/u.test(name),
    );
    expect(inProcess.length).toBeGreaterThan(15);
    const outbound = inProcess.filter((name) =>
      /\bfetch\s*\(|\bfetchImpl\b|\bXMLHttpRequest\b|\bWebSocket\b|https?:\/\/[a-z0-9-]+\.[a-z]/iu.test(
        readFileSync(join(dir, name), 'utf8').replace(
          /\/\*[\s\S]*?\*\/|\/\/.*$/gmu,
          '',
        ),
      ),
    );
    expect(outbound).toEqual([]);
    const transport = readFileSync(
      join(dir, 'production-transport.ts'),
      'utf8',
    );
    expect(transport.match(/\.fetchImpl\(/gu)).toHaveLength(1);
    const invalid = productionPorts(
      vi.fn<typeof fetch>(
        async () =>
          new Response('not json', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
      () => Date.now(),
    ) as unknown as Record<
      string,
      (
        input: unknown,
        signal: AbortSignal,
      ) => Promise<{ ok: boolean; status?: number }>
    >;
    expect(
      (
        await invalid.createTypeDraft?.(
          input('CMS-03A-01'),
          new AbortController().signal,
        )
      )?.status,
    ).toBe(502);
    const down = productionPorts(
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('connection refused');
      }),
      () => Date.now(),
    ) as unknown as typeof invalid;
    expect(
      (
        await down.createTypeDraft?.(
          input('CMS-03A-01'),
          new AbortController().signal,
        )
      )?.status,
    ).toBe(503);
    const hanging = productionPorts(
      vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined)),
      () => Date.now(),
      { deadlineMs: 20 },
    ) as unknown as typeof invalid;
    expect(
      (
        await hanging.createTypeDraft?.(
          input('CMS-03A-01'),
          new AbortController().signal,
        )
      )?.status,
    ).toBe(504);
    const harness = makeHarness();
    harness.ports.createTypeDraft.mockResolvedValueOnce(
      ok({ unexpected: true }),
    );
    const response = await sendHuman(harness, 'CMS-03A-01', validDraft);
    expect(response.status).toBe(502);
    expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
