import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProductionWorkerApp } from '../../apps/worker/src/index';
import {
  AUTH_USER_ID,
  NOW,
  ORIGIN,
  REQUEST_ID,
  SHAPES,
  bindings,
  bodyOf,
  defaultHandlers,
  expectApiError,
  iso,
  json,
  mintJar,
  request,
  type Call,
  type Handler,
} from '../../apps/worker/src/authentication/dec111-composition.test-support';
import { CMS_SCHEMA_REGISTRY_RPC } from '../../apps/worker/src/content-schema-registry/production';
import {
  opFor,
  type EvidenceOperationId,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-support';
import {
  activation,
  validActivation,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';
import { versionPath } from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-test-values';

/**
 * R8 security remediation (BE01a "Consumption", BE03a CMS-03A-04/12/14/15/16/17):
 * every CMS step-up route answers 401 STEP_UP_REQUIRED to a fresh session whose
 * token is not `aal2` with an MFA `amr`, before any CMS RPC. The requests run
 * through the real production Worker (real session verifier, capability
 * resolver, admission, limiter adapter and CMS RPC adapter); only PostgREST and
 * Supabase Auth are faked, and the access token is the only difference between
 * the refused request and its control.
 */
const SECOND = Math.floor(NOW / 1000);
const FRESH = iso(-60);
const MFA_AMR = [{ method: 'totp', timestamp: SECOND - 60 }];
const PROVEN_TOKEN = { aal: 'aal2', amr: MFA_AMR } as const;
const UNPROVEN_TOKENS = [
  ['aal1 with an MFA amr entry', { aal: 'aal1', amr: MFA_AMR }],
  [
    'aal2 without an MFA amr entry',
    { aal: 'aal2', amr: [{ method: 'password', timestamp: SECOND - 30 }] },
  ],
] as const;
const BASELINE_RPCS: readonly string[] = [
  'auth_session_read',
  'auth_rate_limit',
  'admin_context_capabilities',
];

type CmsOperation = Readonly<{
  id: string;
  markers: string;
  capabilities: readonly string[];
  rpc: string;
  method: 'GET' | 'POST';
  path: string;
  body: unknown;
  ifMatch: boolean;
  output: unknown;
}>;

const reviewOperation = (
  id: EvidenceOperationId,
  markers: string,
  capability: string,
): CmsOperation => {
  const op = opFor(id);
  return {
    id,
    markers,
    capabilities: [capability],
    rpc: CMS_SCHEMA_REGISTRY_RPC[
      op.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC
    ],
    method: op.method,
    path: op.path,
    body: op.body,
    ifMatch: op.ifMatch,
    output: op.output,
  };
};

const OPERATIONS: readonly CmsOperation[] = [
  {
    id: 'CMS-03A-04',
    markers: '(CMS-03A-04 carries no aal1 criterion of its own)',
    capabilities: ['cms.schema_designer'],
    rpc: CMS_SCHEMA_REGISTRY_RPC.activateSchema,
    method: 'POST',
    path: versionPath('activate'),
    body: validActivation,
    ifMatch: true,
    output: activation,
  },
  reviewOperation('CMS-03A-12', '[P2-S09-AC-441]', 'cms.schema_review'),
  reviewOperation('CMS-03A-14', '[P2-S09-AC-503]', 'cms.schema_review.assign'),
  ...(['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17'] as const).map(
    (id, index): CmsOperation => {
      const op = opFor(id);
      return {
        id,
        markers: ['[P2-S09-AC-545]', '[P2-S09-AC-574]', '[P2-S09-AC-602]'][
          index
        ] as string,
        capabilities: [],
        rpc: CMS_SCHEMA_REGISTRY_RPC[
          op.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC
        ],
        method: op.method,
        path: op.path,
        body: op.body,
        ifMatch: op.ifMatch,
        output: op.output,
      };
    },
  ),
];

const compose = (operation: CmsOperation) => {
  const calls: Call[] = [];
  const handlers: Record<string, Handler> = {
    ...defaultHandlers,
    admin_context_capabilities: () => json(operation.capabilities),
    [operation.rpc]: () => json(operation.output),
  };
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const rpc = url.pathname.startsWith('/rest/v1/rpc/')
        ? url.pathname.slice('/rest/v1/rpc/'.length)
        : null;
      calls.push({
        url: url.toString(),
        path: url.pathname,
        rpc,
        method: init?.method ?? 'GET',
        body:
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : null,
        headers: new Headers(init?.headers),
        signal: init?.signal ?? null,
      });
      if (rpc === null) return json({ id: AUTH_USER_ID });
      const handler = handlers[rpc];
      return handler === undefined
        ? json({ message: `unexpected rpc ${rpc}` }, 500)
        : handler(calls[calls.length - 1] as Call);
    },
  );
  const environment = { ...bindings, CMS_HUMAN_ORIGINS: ORIGIN };
  const app = createProductionWorkerApp(
    environment,
    fetchImpl as unknown as typeof fetch,
  );
  const send = async (
    accessClaims: Readonly<Record<string, unknown>>,
  ): Promise<Response> => {
    const jar = await mintJar({ stepUpAt: FRESH, accessClaims });
    const built = request({
      method: operation.method,
      path: operation.path,
      ...(operation.method === 'GET' ? {} : { body: operation.body }),
      jar,
      headers: {
        'idempotency-key': 'r8-aal-cms-key-0001',
        ...(operation.ifMatch ? { 'if-match': '"1"' } : {}),
      },
    });
    return app.request(built, undefined, environment);
  };
  return { calls, send };
};

const cmsRpcs = (calls: readonly Call[]): string[] =>
  calls
    .map((call) => call.rpc)
    .filter(
      (rpc): rpc is string => rpc !== null && !BASELINE_RPCS.includes(rpc),
    );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe.each(OPERATIONS)(
  '$id requires an aal2 token with an MFA amr in addition to a fresh instant',
  (operation) => {
    it.each(UNPROVEN_TOKENS)(
      `${operation.markers} a fresh session whose token is %s is refused with 401 STEP_UP_REQUIRED and the exact step-up details`,
      async (_label, accessClaims) => {
        const response = await compose(operation).send(accessClaims);
        const body = await expectApiError(response, {
          status: 401,
          code: 'STEP_UP_REQUIRED',
          shape: SHAPES.stepUp,
        });
        expect(body.requestId).toBe(REQUEST_ID);
      },
    );

    it.each(UNPROVEN_TOKENS)(
      `${operation.markers} a fresh session whose token is %s reaches no CMS RPC`,
      async (_label, accessClaims) => {
        const composed = compose(operation);
        await composed.send(accessClaims);
        expect(cmsRpcs(composed.calls)).toStrictEqual([]);
      },
    );

    it(`${operation.markers} the same fresh session with an aal2 token carrying an MFA amr reaches the CMS RPC`, async () => {
      const composed = compose(operation);
      const response = await composed.send(PROVEN_TOKEN);
      expect(cmsRpcs(composed.calls)).toStrictEqual([operation.rpc]);
      expect(response.status).toBeLessThan(300);
      expect((await bodyOf(response)).code).toBeUndefined();
    });
  },
);
