/**
 * R8 cross-surface 429 family. The 429 is PRODUCED by the real Worker: the real
 * Hono app, the real CMS limiter and the real authentication limiter adapter run
 * against a fake PostgREST that answers `platform_api.auth_rate_limit` with the
 * database's decision shape, and the per-user bucket is exhausted by real
 * requests that travel through the real web boundary. The web boundary then
 * relays the Worker's refusal to the browser. Only PostgREST is faked.
 *
 * The Worker emits BE00 `resetAt` as an RFC 3339 UTC string (the limiter window
 * end); this proves the production web path preserves it for every browser-facing
 * CMS-03A operation of the 429 family.
 */
import { describe, expect, it } from 'vitest';

import {
  forwardContentSchemaRegistryMutation,
  type ContentSchemaRegistryMutationTarget,
} from '../../apps/web/src/server/content-schema-registry-platform-api';
import { forwardCmsCapabilityGrantListRead } from '../../apps/web/src/server/cms-capability-grant-platform-api';
import {
  opFor,
  requestFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-support';
import {
  authRateModel,
  composeProduction,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-r2-support';
import { CMS_ORIGIN } from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';

const USER = '10000000-0000-4000-8000-000000000001';
/** 17 s into a 60 s window: 43 s remain, so a constant could not pass. */
const CLOCK_MS = 1_788_345_617_000;
const WINDOW_END_ISO = '2026-09-02T10:41:00.000Z';
const WEB_ORIGIN = 'https://app.test';

type Row = readonly [marker: string, operationId: EvidenceOperationId];

/** The 429 rows whose browser-facing mutation the web forwards. */
const MUTATION_ROWS: readonly Row[] = [
  ['[P2-S09-AC-311]', 'CMS-03A-09'],
  ['[P2-S09-AC-357]', 'CMS-03A-10'],
  ['[P2-S09-AC-399]', 'CMS-03A-11'],
  ['[P2-S09-AC-436]', 'CMS-03A-12'],
  ['[P2-S09-AC-498]', 'CMS-03A-14'],
  ['[P2-S09-AC-540]', 'CMS-03A-15'],
  ['[P2-S09-AC-569]', 'CMS-03A-16'],
  ['[P2-S09-AC-597]', 'CMS-03A-17'],
];

const targetFor = (op: EvidenceOp): ContentSchemaRegistryMutationTarget => ({
  operationId: op.operationId as ContentSchemaRegistryMutationTarget['operationId'],
  ...op.pathParams,
});

const webMutation = (op: EvidenceOp, sequence: number): Request =>
  new Request(`${WEB_ORIGIN}/app/cms-content-modeling`, {
    method: 'POST',
    headers: {
      origin: WEB_ORIGIN,
      cookie: 'wj_access=session; wj_csrf=csrf-token-123',
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': `r8-429-key-${String(sequence).padStart(6, '0')}`,
      ...(op.ifMatch ? { 'if-match': '"1"' } : {}),
    },
    body: JSON.stringify(op.body),
  });

/** Exhaust the per-user bucket through the web boundary, then refuse once more. */
const refusedThroughWeb = async (
  op: EvidenceOp,
  send: (
    composed: ReturnType<typeof composeProduction>,
    sequence: number,
  ) => Promise<Response>,
): Promise<{ response: Response; workerStatus: number }> => {
  const rate = authRateModel(() => Math.floor(CLOCK_MS / 1000));
  const composed = composeProduction(op, {
    nowMs: () => CLOCK_MS,
    rate,
    userId: () => USER,
  });
  let sequence = 0;
  let last: Response = new Response(null, { status: 500 });
  for (let index = 0; index <= op.limit; index += 1) {
    sequence += 1;
    last = await send(composed, sequence);
  }
  return { response: last, workerStatus: last.status };
};

const bindingFor = (composed: ReturnType<typeof composeProduction>) => ({
  fetch: async (request: Request): Promise<Response> => {
    const forwarded = new Request(request, {
      headers: (() => {
        const headers = new Headers(request.headers);
        headers.set('origin', CMS_ORIGIN);
        return headers;
      })(),
    });
    return composed.send(forwarded);
  },
});

describe('R8 429 RATE_LIMITED across the Worker and the web boundary', () => {
  it.each(MUTATION_ROWS)(
    '%s %s the web mutation boundary relays the real Worker 429 with resetAt as the RFC 3339 limiter window end',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { response } = await refusedThroughWeb(op, (composed, sequence) =>
        forwardContentSchemaRegistryMutation(
          webMutation(op, sequence),
          bindingFor(composed),
          targetFor(op),
        ),
      );
      expect(response.status).toBe(429);
      const body = (await response.json()) as {
        code: string;
        details: Record<string, unknown>;
      };
      expect(body.code).toBe('RATE_LIMITED');
      expect(body.details).toEqual({
        limit: op.limit,
        resetAt: WINDOW_END_ISO,
        retryAfterSeconds: 43,
      });
    },
  );

  it('[P2-S09-AC-623] the web grant-list read relays the real Worker 429 of CMS-03A-18 with resetAt as the RFC 3339 limiter window end', async () => {
    const op = opFor('CMS-03A-18');
    const { response } = await refusedThroughWeb(op, (composed) =>
      forwardCmsCapabilityGrantListRead(
        new Request(`${WEB_ORIGIN}/api/v1/cms/capability-grants?limit=20`, {
          method: 'GET',
          headers: {
            cookie: 'wj_access=session',
            origin: WEB_ORIGIN,
          },
        }),
        bindingFor(composed),
      ),
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details).toEqual({
      limit: op.limit,
      resetAt: WINDOW_END_ISO,
      retryAfterSeconds: 43,
    });
  });

  it('[P2-S09-AC-311] the relayed 429 keeps the Retry-After header the Worker derived from the same window', async () => {
    const op = opFor('CMS-03A-09');
    const { response } = await refusedThroughWeb(op, (composed, sequence) =>
      forwardContentSchemaRegistryMutation(
        webMutation(op, sequence),
        bindingFor(composed),
        targetFor(op),
      ),
    );
    expect(response.headers.get('retry-after')).toBe('43');
  });

  it('[P2-S09-AC-311] the exhaustion is real: the request before the limit succeeds and the one after is refused', async () => {
    const op = opFor('CMS-03A-09');
    const statuses: number[] = [];
    await refusedThroughWeb(op, async (composed, sequence) => {
      const response = await forwardContentSchemaRegistryMutation(
        webMutation(op, sequence),
        bindingFor(composed),
        targetFor(op),
      );
      statuses.push(response.status);
      return response;
    });
    expect(statuses.slice(0, op.limit).every((status) => status === 201)).toBe(
      true,
    );
    expect(statuses[op.limit]).toBe(429);
  });
});
