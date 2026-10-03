import { describe, expect, it, vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import { releaseEvidenceFor } from './release-verifier';
import {
  BLOCK_ID,
  TYPE_ID,
  VERSION_ID,
  validActivation,
  validBlock,
  validDraft,
  validField,
  validLifecycle,
  validRelation,
} from './phase-02-slice-09-test-values';
import {
  REQUEST_ID,
  json,
  options,
  releasePrincipal,
  releaseHeaders,
  requestContext,
} from './production-test-support';

/**
 * AC034 Worker half through the PRODUCTION RPC adapter: the Worker maps whatever
 * the database raises. For every original operation that can conceal a resource
 * (CMS-03A-01 through -05, -07, -08) a concealed owner, a concealed scope and an
 * absent resource are raised as three different database messages, and the wire
 * answer is one byte-identical 404 that carries none of the three reasons; a
 * readable resource with insufficient capability is the distinct 403. The
 * condition itself (which row the database conceals) is the pgTAP proof.
 */
const HUMAN_ORIGIN = 'https://cms.example.test';
const RELEASE_ORIGIN = 'https://release.example.test';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const API = 'https://api.example.test';
const FIELD_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/fields`;
const RELATION_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/relations`;
const ACTIVATE_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/activate`;
const DETAIL_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const LIFECYCLE_PATH = `/api/v1/cms/blocks/versions/${BLOCK_ID}/lifecycle`;

type Case = Readonly<{
  operationId: string;
  build: () => Request;
}>;

const human =
  (path: string, body: unknown, withMatch: boolean): (() => Request) =>
  () =>
    new Request(`${API}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: HUMAN_ORIGIN,
        'idempotency-key': 'cms-authority-key-0001',
        'x-request-id': REQUEST_ID,
        ...(withMatch ? { 'if-match': '"1"' } : {}),
      },
      body: JSON.stringify(body),
    });

const release =
  (path: string, body: unknown, withMatch: boolean): (() => Request) =>
  () =>
    new Request(`${API}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: RELEASE_ORIGIN,
        'idempotency-key': 'cms-authority-key-0002',
        'x-request-id': REQUEST_ID,
        'x-wejammin-release-key-id': releaseHeaders.keyId,
        'x-wejammin-release-issued-at': releaseHeaders.issuedAt,
        'x-wejammin-release-nonce': releaseHeaders.nonce,
        'x-wejammin-release-signature': releaseHeaders.signature,
        ...(withMatch ? { 'if-match': '"1"' } : {}),
      },
      body: JSON.stringify(body),
    });

const CASES: readonly Case[] = [
  {
    operationId: 'CMS-03A-01',
    build: human('/api/v1/cms/content-types', validDraft, false),
  },
  {
    operationId: 'CMS-03A-02',
    build: human(FIELD_PATH, { ...validField }, true),
  },
  {
    operationId: 'CMS-03A-03',
    build: human(RELATION_PATH, { ...validRelation }, true),
  },
  {
    operationId: 'CMS-03A-04',
    build: human(ACTIVATE_PATH, validActivation, true),
  },
  {
    operationId: 'CMS-03A-05',
    build: release('/api/v1/cms/blocks/versions', validBlock, false),
  },
  {
    operationId: 'CMS-03A-07',
    build: () =>
      new Request(`${API}${DETAIL_PATH}`, {
        headers: { origin: HUMAN_ORIGIN, 'x-request-id': REQUEST_ID },
      }),
  },
  {
    operationId: 'CMS-03A-08',
    build: release(LIFECYCLE_PATH, validLifecycle, true),
  },
];

const send = async (
  testCase: Case,
  rpcRaises: Record<string, unknown>,
): Promise<Response> => {
  const fetchImpl = vi.fn<typeof fetch>(async () => json(rpcRaises, 400));
  const dependencies = createProductionContentSchemaRegistryDependencies(
    options(fetchImpl, {
      humanOrigins: [HUMAN_ORIGIN],
      releaseOrigins: [RELEASE_ORIGIN],
      now: () => NOW,
      verifyRelease: async (
        input: Parameters<typeof releaseEvidenceFor>[0],
      ) => ({
        ok: true as const,
        value: {
          ...releasePrincipal,
          keyId: input.headers.keyId,
          ...(await releaseEvidenceFor(input)),
        },
      }),
      resolveRequestContext: vi.fn(async () => ({
        ...requestContext,
        capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
      })),
    }),
  );
  const response = await createContentSchemaRegistryApp(dependencies).request(
    testCase.build(),
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  return response;
};

const raised = (message: string, detail: string) => ({
  code: 'P0001',
  message,
  details: detail,
  hint: null,
});

describe('[P2-S09-AC-034] production adapter: 403 for insufficient capability, one concealed 404', () => {
  it.each(CASES)(
    '[P2-S09-AC-034] $operationId maps a concealed owner, a concealed scope and an absent resource to one byte-identical 404 that names none of them',
    async (testCase) => {
      const bodies: string[] = [];
      for (const reason of [
        'owner concealed for organization 77',
        'registry scope concealed',
        'resource absent',
      ]) {
        const response = await send(testCase, raised('NOT_FOUND', reason));
        expect(response.status).toBe(404);
        bodies.push(await response.text());
      }
      expect(new Set(bodies).size).toBe(1);
      const body = JSON.parse(bodies[0] as string) as Record<string, unknown>;
      expect(body.code).toBe('NOT_FOUND');
      expect(body.details).toEqual({});
      expect(bodies[0]).not.toMatch(/concealed|absent|organization|scope/iu);
    },
  );

  it.each(CASES)(
    '[P2-S09-AC-034] $operationId maps a readable resource without the capability to 403 FORBIDDEN, never 404',
    async (testCase) => {
      const response = await send(
        testCase,
        raised('FORBIDDEN', 'capability cms.schema_designer missing'),
      );
      expect(response.status).toBe(403);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body.code).toBe('FORBIDDEN');
      expect(text).not.toMatch(/cms\.schema_designer|missing/u);
    },
  );
});
