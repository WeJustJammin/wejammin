/**
 * Registry parity for the eight original operations A01-A08: the declared
 * route policy (method, path, request and success schema, auth, capability,
 * CORS, rate, timeout, cache, SLO, errors) is what the real route tree, the
 * real admission pipeline and the OpenAPI document do.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
  type ContentSchemaRegistryRoutePolicy,
} from '@wejammin/contracts';

import { humanBodySchemas, schemaForReleaseOperation } from './admission';
import {
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  SchemaActivationRequestSchema,
  BlockRegistrationRequestSchema,
  BlockLifecycleAdvanceRequestSchema,
  ContentSchemaRegistryDetailParamsSchema,
  ContentSchemaRegistryListQuerySchema,
} from './contracts';
import {
  makeSignedHarness,
  makeSigning,
  type SignedHarness,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  RELEASE_ORIGIN,
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

const ORIGINAL = contentSchemaRegistryRoutePolicies.filter(
  (policy) => Number(policy.operationId.slice(-2)) <= 8,
);
type Original = ContentSchemaRegistryRoutePolicy;
const honoPath = (path: string): string => path.replace(/\{(\w+)\}/gu, ':$1');
const BODY: Record<string, unknown> = {
  'CMS-03A-01': validDraft,
  'CMS-03A-02': validField,
  'CMS-03A-03': validRelation,
  'CMS-03A-04': validActivation,
  'CMS-03A-05': validBlock,
  'CMS-03A-08': validLifecycle,
};
const REQUEST_SCHEMAS: Record<string, unknown> = {
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  SchemaActivationRequestSchema,
  BlockRegistrationRequestSchema,
  BlockLifecycleAdvanceRequestSchema,
  ContentSchemaRegistryDetailParamsSchema,
  ContentSchemaRegistryListQuerySchema,
};
const PATHS: Record<string, string> = {
  'CMS-03A-01': '/api/v1/cms/content-types',
  'CMS-03A-02': mutationPath.field,
  'CMS-03A-03': mutationPath.relation,
  'CMS-03A-04': mutationPath.activate,
  'CMS-03A-05': '/api/v1/cms/blocks/versions',
  'CMS-03A-06': '/api/v1/cms/content-types',
  'CMS-03A-07':
    '/api/v1/cms/content-types/30000000-0000-4000-8000-000000000003/versions/40000000-0000-4000-8000-000000000004',
  'CMS-03A-08': mutationPath.lifecycle,
};
const PORT: Record<string, keyof ReturnType<typeof makeHarness>['ports']> = {
  'CMS-03A-01': 'createTypeDraft',
  'CMS-03A-02': 'addFieldDefinition',
  'CMS-03A-03': 'bindRelation',
  'CMS-03A-04': 'activateSchema',
  'CMS-03A-05': 'registerBlock',
  'CMS-03A-06': 'listContentTypes',
  'CMS-03A-07': 'getContentTypeVersion',
  'CMS-03A-08': 'advanceBlockLifecycle',
};
let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning();
});

const isRelease = (policy: Original): boolean =>
  policy.audience === 'release-worker';
const sendOriginal = async (
  policy: Original,
  options: {
    harness?: ReturnType<typeof makeHarness>;
    signed?: SignedHarness;
  } = {},
): Promise<Response> => {
  const id = policy.operationId;
  if (isRelease(policy)) {
    const signed = options.signed ?? (await makeSignedHarness({ signing }));
    return signed.send(id as 'CMS-03A-05', BODY[id]);
  }
  const harness = options.harness ?? makeHarness();
  if (policy.method === 'GET')
    return harness.app.request(
      new Request(`${API_ORIGIN}${PATHS[id] as string}`, {
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
  return harness.app.request(
    jsonRequest(
      PATHS[id] as string,
      BODY[id],
      policy.ifMatch === 'required' ? { 'if-match': '"1"' } : {},
    ),
  );
};

describe('A01-A08 route registry parity', () => {
  it('[P2-S09-AC-018] [P2-S09-AC-214] registers exactly the eight original operations with the declared method, path, operation id, request schema, success status and OpenAPI entry', async () => {
    expect(ORIGINAL.map((policy) => policy.operationId)).toEqual([
      'CMS-03A-01',
      'CMS-03A-02',
      'CMS-03A-03',
      'CMS-03A-04',
      'CMS-03A-05',
      'CMS-03A-06',
      'CMS-03A-07',
      'CMS-03A-08',
    ]);
    const harness = makeHarness();
    const discovered = harness.app.routes
      .filter((route) => route.method !== 'ALL')
      .map((route) => `${route.method} ${route.path}`);
    const document = buildContentSchemaRegistryOpenApiDocument();
    for (const policy of ORIGINAL) {
      expect(discovered, policy.operationId).toContain(
        `${policy.method} ${honoPath(policy.path)}`,
      );
      const operation = document.paths[policy.path]?.[
        policy.method.toLowerCase()
      ] as { operationId: string; responses: Record<string, unknown> };
      expect(operation.operationId).toBe(policy.operationId);
      for (const status of [policy.successStatus])
        expect(Object.keys(operation.responses)).toContain(String(status));
      expect(
        REQUEST_SCHEMAS[policy.requestSchema],
        policy.requestSchema,
      ).toBeDefined();
      if (policy.method === 'POST') {
        const bound = isRelease(policy)
          ? schemaForReleaseOperation(policy.operationId as 'CMS-03A-05')
          : humanBodySchemas[policy.operationId as 'CMS-03A-01'];
        expect(bound, policy.operationId).toBe(
          REQUEST_SCHEMAS[policy.requestSchema],
        );
      }
      const response = await sendOriginal(policy);
      expect(response.status, policy.operationId).toBe(
        policy.operationId === 'CMS-03A-04' ? 200 : policy.successStatus,
      );
    }
    const mutationPaths = discovered.filter(
      (route) =>
        route.startsWith('POST /api/v1/cms/') &&
        /fields|relations|activate|blocks/u.test(route),
    );
    expect(mutationPaths.length).toBeGreaterThanOrEqual(5);
  });

  it('[P2-S09-AC-030] [P2-S09-AC-214] enforces each route’s declared per-user and per-party limit, 15,000 ms deadline, no-store policy and Tier 2 SLO', async () => {
    for (const policy of ORIGINAL) {
      const human = makeHarness();
      const signed = isRelease(policy)
        ? await makeSignedHarness({ signing })
        : undefined;
      const response = await sendOriginal(policy, {
        harness: human,
        ...(signed === undefined ? {} : { signed }),
      });
      expect(response.headers.get('cache-control'), policy.operationId).toBe(
        policy.cacheControl,
      );
      const rate = (signed?.rateLimit ?? human.rateLimit).mock
        .calls[0]?.[0] as {
        limit: number;
        partyLimit?: number;
        windowSeconds: number;
        rateClass: string;
        principalClass: string;
      };
      expect(rate.limit).toBe(policy.rateLimit);
      expect(rate.windowSeconds).toBe(policy.rateWindowSeconds);
      expect(rate.rateClass).toBe(policy.rateClass);
      expect(rate.partyLimit).toBe(
        'partyRateLimit' in policy ? policy.partyRateLimit : undefined,
      );
      expect(rate.principalClass).toBe(
        isRelease(policy) ? 'release-worker' : 'human',
      );
      const event = (signed?.telemetry ?? human.telemetry).mock.calls.at(
        -1,
      )?.[0] as {
        deadlineMs: number;
        slo: unknown;
        rateLimit: number;
        rateClass: string;
      };
      expect(event.deadlineMs).toBe(policy.timeoutMs);
      expect(event.slo).toEqual(policy.slo);
      expect(event.rateLimit).toBe(policy.rateLimit);
      expect(policy.timeoutMs).toBe(15_000);
      expect(policy.slo).toEqual({
        tier: 2,
        commandP95Ms: 1_200,
        protectedRpcP95Ms: 300,
        acceptanceP99Ms: 1_000,
      });
    }
  });

  it('[P2-S09-AC-214] [P2-S09-AC-031] [P2-S09-AC-032] answers every declared error status of every original operation with the BE00 ApiError envelope (code, message, requestId, bounded details)', async () => {
    for (const policy of ORIGINAL) {
      const declared = [...new Set(Object.values(policy.errors))].sort();
      const produced = new Set<number>();
      const check = async (
        response: Response,
        status: number,
      ): Promise<void> => {
        expect(response.status, `${policy.operationId} ${status}`).toBe(status);
        const body = (await response.json()) as {
          code: string;
          message: string;
          requestId: string;
          details: Record<string, unknown>;
        };
        expect(Object.keys(body).sort()).toEqual([
          'code',
          'details',
          'message',
          'requestId',
        ]);
        expect(body.code).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/u);
        expect(body.message.length).toBeGreaterThan(0);
        expect(body.requestId).toBe(REQUEST_ID);
        expect(JSON.stringify(body.details).length).toBeLessThanOrEqual(8192);
        expect(JSON.stringify(body)).not.toMatch(
          /SQLSTATE|stack|ownerId|Error:/u,
        );
        produced.add(status);
      };
      const rpc = async (result: unknown, status: number) => {
        const harness = makeHarness();
        const signed = isRelease(policy)
          ? await makeSignedHarness({ signing })
          : undefined;
        const port =
          signed === undefined
            ? harness.ports[
                PORT[policy.operationId] as string as 'createTypeDraft'
              ]
            : policy.operationId === 'CMS-03A-05'
              ? signed.registerBlock
              : signed.advanceBlockLifecycle;
        port.mockResolvedValueOnce(result);
        await check(
          await sendOriginal(policy, {
            harness,
            ...(signed === undefined ? {} : { signed }),
          }),
          status,
        );
      };
      // 502 / 503 / 504 / 500 / 409 / 404 come from the RPC; 400 / 401 / 403 / 413 / 415 / 422 / 429 come from admission.
      for (const status of [502, 503, 504] as const)
        await rpc(error(status, 'DEPENDENCY_UNAVAILABLE'), status);
      if (declared.includes(409))
        await rpc(
          error(409, 'CONFLICT', 'c', { conflict: 'VERSION_MISMATCH' }),
          409,
        );
      if (declared.includes(404)) await rpc(error(404, 'NOT_FOUND'), 404);
      const crashing = makeHarness();
      const signedCrash = isRelease(policy)
        ? await makeSignedHarness({ signing })
        : undefined;
      const crashPort =
        signedCrash === undefined
          ? crashing.ports[
              PORT[policy.operationId] as string as 'createTypeDraft'
            ]
          : policy.operationId === 'CMS-03A-05'
            ? signedCrash.registerBlock
            : signedCrash.advanceBlockLifecycle;
      crashPort.mockRejectedValueOnce(new Error('boom'));
      await check(
        await sendOriginal(policy, {
          harness: crashing,
          ...(signedCrash === undefined ? {} : { signed: signedCrash }),
        }),
        500,
      );
      if (isRelease(policy)) {
        const bad = await makeSignedHarness({ signing });
        await check(
          await bad.send(
            policy.operationId as 'CMS-03A-05',
            BODY[policy.operationId],
            { signRaw: '{}' },
          ),
          401,
        );
        await check(
          await bad.send(
            policy.operationId as 'CMS-03A-05',
            BODY[policy.operationId],
            { extra: { 'x-release-key-id': 'a' } },
          ),
          400,
        );
        await check(
          await bad.send(
            policy.operationId as 'CMS-03A-05',
            BODY[policy.operationId],
            { extra: { 'content-type': 'text/plain' } },
          ),
          415,
        );
        await check(
          await bad.send(policy.operationId as 'CMS-03A-05', { nope: 1 }),
          422,
        );
        await check(
          await bad.send(
            policy.operationId as 'CMS-03A-05',
            BODY[policy.operationId],
            { extra: { origin: CMS_ORIGIN } },
          ),
          403,
        );
        bad.rateLimit.mockResolvedValueOnce(
          ok({
            allowed: false,
            limit: 20,
            remaining: 0,
            resetAt: 1_788_345_660,
          }),
        );
        await check(
          await bad.send(
            policy.operationId as 'CMS-03A-05',
            BODY[policy.operationId],
          ),
          429,
        );
      } else {
        const anonymous = makeHarness({
          session: error(401, 'UNAUTHENTICATED'),
        });
        await check(await sendOriginal(policy, { harness: anonymous }), 401);
        const forbidden = makeHarness({
          session: ok({ ...session, capabilities: [] }),
        });
        await check(await sendOriginal(policy, { harness: forbidden }), 403);
        const limited = makeHarness({
          rate: ok({
            allowed: false,
            limit: 30,
            remaining: 0,
            resetAt: 1_788_345_660,
          }),
        });
        await check(await sendOriginal(policy, { harness: limited }), 429);
        const malformed = makeHarness();
        const bad =
          policy.method === 'GET'
            ? new Request(
                `${API_ORIGIN}${PATHS[policy.operationId] as string}?bogus=1`,
                {
                  headers: {
                    origin: CMS_ORIGIN,
                    authorization: 'Bearer x',
                    'x-request-id': REQUEST_ID,
                  },
                },
              )
            : jsonRequest(
                PATHS[policy.operationId] as string,
                BODY[policy.operationId],
                {
                  'idempotency-key': 'x',
                  ...(policy.ifMatch === 'required'
                    ? { 'if-match': '"1"' }
                    : {}),
                },
              );
        await check(await malformed.app.request(bad), 400);
        if (policy.method === 'POST') {
          const media = makeHarness();
          await check(
            await media.app.request(
              jsonRequest(
                PATHS[policy.operationId] as string,
                BODY[policy.operationId],
                {
                  'content-type': 'text/plain',
                  ...(policy.ifMatch === 'required'
                    ? { 'if-match': '"1"' }
                    : {}),
                },
              ),
            ),
            415,
          );
          const invalid = makeHarness();
          await check(
            await invalid.app.request(
              jsonRequest(
                PATHS[policy.operationId] as string,
                { not: 'valid' },
                policy.ifMatch === 'required' ? { 'if-match': '"1"' } : {},
              ),
            ),
            422,
          );
        } else if (policy.operationId === 'CMS-03A-06') {
          await check(
            await makeHarness().app.request(
              new Request(
                `${API_ORIGIN}${PATHS[policy.operationId] as string}?limit=101`,
                {
                  headers: {
                    origin: CMS_ORIGIN,
                    authorization: 'Bearer x',
                    'x-request-id': REQUEST_ID,
                  },
                },
              ),
            ),
            422,
          );
        }
      }
      for (const status of declared)
        expect(
          [...produced],
          `${policy.operationId} declared ${status}`,
        ).toContain(status);
      for (const status of produced)
        if (status !== 413)
          expect(
            declared,
            `${policy.operationId} undeclared ${status}`,
          ).toContain(status);
    }
  });

  it('[P2-S09-AC-029] keys every rate bucket to the verified actor, acting party or release principal and keeps activation and registration on separate classes', async () => {
    const human = makeHarness();
    await human.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft, {
        'x-actor-id': 'forged',
        'x-acting-party-id': 'forged',
      }),
    );
    const input = human.rateLimit.mock.calls[0]?.[0] as {
      actorId: string;
      actingPartyId: string | null;
      principalClass: string;
    };
    expect([input.actorId, input.actingPartyId, input.principalClass]).toEqual([
      session.userId,
      session.actingPartyId,
      'human',
    ]);
    const signed = await makeSignedHarness({ signing });
    await signed.send('CMS-03A-05', validBlock);
    const release = signed.rateLimit.mock.calls[0]?.[0] as {
      actorId: string;
      actingPartyId: string | null;
      principalClass: string;
    };
    expect(release.actorId).toBe('a9090000-0000-0000-0000-000000000002');
    expect([release.actingPartyId, release.principalClass]).toEqual([
      null,
      'release-worker',
    ]);
    const classes = Object.fromEntries(
      ORIGINAL.map((policy) => [
        policy.operationId,
        [policy.rateClass, policy.rateLimit],
      ]),
    );
    expect(classes['CMS-03A-04']).toEqual(['cms-activation', 10]);
    expect(classes['CMS-03A-01']).toEqual(['cms-definition-write', 30]);
    expect(classes['CMS-03A-05']).toEqual(['release-registry-write', 20]);
    expect(classes['CMS-03A-08']).toEqual(['release-registry-lifecycle', 20]);
    expect(
      new Set([
        classes['CMS-03A-04']?.[0],
        classes['CMS-03A-01']?.[0],
        classes['CMS-03A-05']?.[0],
        classes['CMS-03A-08']?.[0],
      ]).size,
    ).toBe(4);
    expect(RELEASE_ORIGIN).toBeDefined();
  });

  it('[P2-S09-AC-033] answers malformed structure with 400, a missing or invalid principal with 401 and unsupported media with 415 before any domain mutation', async () => {
    for (const policy of ORIGINAL.filter(
      (candidate) => candidate.method === 'POST',
    )) {
      if (isRelease(policy)) {
        const harness = await makeSignedHarness({ signing });
        const port =
          policy.operationId === 'CMS-03A-05'
            ? harness.registerBlock
            : harness.advanceBlockLifecycle;
        const syntax = await harness.send(
          policy.operationId as 'CMS-03A-05',
          null,
          { raw: '{"blockKey":' },
        );
        expect(syntax.status).toBe(400);
        expect(
          (
            await harness.send(
              policy.operationId as 'CMS-03A-05',
              BODY[policy.operationId],
              { signRaw: '{}' },
            )
          ).status,
        ).toBe(401);
        expect(
          (
            await harness.send(
              policy.operationId as 'CMS-03A-05',
              BODY[policy.operationId],
              { extra: { 'content-type': 'application/xml' } },
            )
          ).status,
        ).toBe(415);
        expect(port).not.toHaveBeenCalled();
        continue;
      }
      const harness = makeHarness({ session: error(401, 'UNAUTHENTICATED') });
      const headers =
        policy.ifMatch === 'required' ? { 'if-match': '"1"' } : {};
      const syntax = await harness.app.request(
        new Request(`${API_ORIGIN}${PATHS[policy.operationId] as string}`, {
          method: 'POST',
          headers: {
            origin: CMS_ORIGIN,
            authorization: 'Bearer x',
            'content-type': 'application/json',
            'idempotency-key': 'cms-test-key-001',
            ...headers,
          },
          body: '{"unterminated":',
        }),
      );
      expect(syntax.status, policy.operationId).toBe(400);
      expect(
        (
          await harness.app.request(
            jsonRequest(
              PATHS[policy.operationId] as string,
              BODY[policy.operationId],
              headers,
            ),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await harness.app.request(
            jsonRequest(
              PATHS[policy.operationId] as string,
              BODY[policy.operationId],
              { ...headers, 'content-type': 'text/plain' },
            ),
          )
        ).status,
      ).toBe(415);
      expect(
        harness.ports[PORT[policy.operationId] as 'createTypeDraft'],
      ).not.toHaveBeenCalled();
    }
    const reads = makeHarness({ session: error(401, 'UNAUTHENTICATED') });
    expect(
      (
        await reads.app.request(
          new Request(`${API_ORIGIN}/api/v1/cms/content-types?bogus=1`, {
            headers: { origin: CMS_ORIGIN },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await reads.app.request(
          new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
            headers: { origin: CMS_ORIGIN },
          }),
        )
      ).status,
    ).toBe(401);
    expect(reads.ports.listContentTypes).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-034] answers 403 for a readable resource lacking the capability and a byte-identical 404 for every concealed owner, scope or resource', async () => {
    for (const policy of ORIGINAL.filter((candidate) =>
      ['CMS-03A-02', 'CMS-03A-03', 'CMS-03A-07', 'CMS-03A-08'].includes(
        candidate.operationId,
      ),
    )) {
      const bodies: string[] = [];
      for (const reason of [
        'owner concealed',
        'scope concealed',
        'resource absent',
      ]) {
        const harness = makeHarness();
        const signed = isRelease(policy)
          ? await makeSignedHarness({ signing })
          : undefined;
        const port =
          signed === undefined
            ? harness.ports[PORT[policy.operationId] as 'createTypeDraft']
            : signed.advanceBlockLifecycle;
        port.mockResolvedValueOnce(
          error(404, 'NOT_FOUND', reason, { ownerId: USER_ID, reason }),
        );
        const response = await sendOriginal(policy, {
          harness,
          ...(signed === undefined ? {} : { signed }),
        });
        expect(response.status).toBe(404);
        bodies.push(await response.text());
      }
      expect(new Set(bodies).size, policy.operationId).toBe(1);
      expect(bodies[0]).not.toMatch(/concealed|absent|ownerId/u);
    }
    for (const policy of ORIGINAL.filter(
      (candidate) => !isRelease(candidate),
    )) {
      const harness = makeHarness({
        session: ok({ ...session, capabilities: ['cms.schema_review'] }),
      });
      const response = await sendOriginal(policy, { harness });
      expect(response.status, policy.operationId).toBe(403);
      expect(
        ((await response.json()) as { details: { reasonCode: string } }).details
          .reasonCode,
      ).toBe('CAPABILITY_REQUIRED');
    }
  });
});
