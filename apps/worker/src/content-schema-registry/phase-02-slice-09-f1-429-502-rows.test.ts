/**
 * F1 closure: the 429 RATE_LIMITED and 502 DEPENDENCY_UNAVAILABLE rows of the
 * BE03a CMS-03A-09..18 error matrix, with the condition PRODUCED rather than
 * told.
 *  - 429: the real Hono app, the real CMS limiter and the real authentication
 *    limiter adapter run against a fake PostgREST that answers
 *    `platform_api.auth_rate_limit` with the database's own decision shape
 *    (`{ allowed, limit, remaining, resetAt }`, counted per operation id,
 *    bucket digest and window; the database half is proven in
 *    supabase/tests/phase_02_slice_09_f1_cms_rate_limit.sql). The limit is
 *    exhausted by real requests; nothing is told to refuse.
 *  - 502: the real production RPC adapter receives a response from the fake
 *    PostgREST that does not satisfy the operation's output contract.
 * Only the external dependency (PostgREST) is faked.
 */
import { describe, expect, it } from 'vitest';

import {
  opFor,
  requestFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  authRateModel,
  bodyOf,
  composeProduction,
  raised,
} from './phase-02-slice-09-r2-support';
import { json } from './production-test-support';

type Row = readonly [marker: string, operationId: EvidenceOperationId];

const E429: readonly Row[] = [
  ['[P2-S09-AC-311]', 'CMS-03A-09'],
  ['[P2-S09-AC-357]', 'CMS-03A-10'],
  ['[P2-S09-AC-399]', 'CMS-03A-11'],
  ['[P2-S09-AC-436]', 'CMS-03A-12'],
  ['[P2-S09-AC-459]', 'CMS-03A-13'],
  ['[P2-S09-AC-498]', 'CMS-03A-14'],
  ['[P2-S09-AC-540]', 'CMS-03A-15'],
  ['[P2-S09-AC-569]', 'CMS-03A-16'],
  ['[P2-S09-AC-597]', 'CMS-03A-17'],
  ['[P2-S09-AC-623]', 'CMS-03A-18'],
];

const E502: readonly Row[] = [
  ['[P2-S09-AC-312]', 'CMS-03A-09'],
  ['[P2-S09-AC-358]', 'CMS-03A-10'],
  ['[P2-S09-AC-400]', 'CMS-03A-11'],
  ['[P2-S09-AC-437]', 'CMS-03A-12'],
  ['[P2-S09-AC-460]', 'CMS-03A-13'],
  ['[P2-S09-AC-499]', 'CMS-03A-14'],
  ['[P2-S09-AC-541]', 'CMS-03A-15'],
  ['[P2-S09-AC-570]', 'CMS-03A-16'],
  ['[P2-S09-AC-598]', 'CMS-03A-17'],
  ['[P2-S09-AC-624]', 'CMS-03A-18'],
];

const USER = '10000000-0000-4000-8000-000000000001';
/** 17 s into a 60 s window: 43 s remain, so a constant could not pass. */
const CLOCK_MS = 1_788_345_617_000;
const WINDOW_END_EPOCH = 1_788_345_660;
const WINDOW_END_ISO = '2026-09-02T10:41:00.000Z';
const ENVELOPE_KEYS = ['code', 'details', 'message', 'requestId'];

/** Exhaust the user bucket with real requests and return the next response. */
const exhaustAndRefuse = async (op: EvidenceOp) => {
  const rate = authRateModel(() => Math.floor(CLOCK_MS / 1000));
  const composed = composeProduction(op, {
    nowMs: () => CLOCK_MS,
    rate,
    userId: () => USER,
  });
  let sequence = 0;
  const send = () => {
    sequence += 1;
    return composed.send(
      requestFor(op, {
        headers:
          op.method === 'POST'
            ? {
                'idempotency-key': `f1-429-key-${String(sequence).padStart(6, '0')}`,
              }
            : {},
      }),
    );
  };
  for (let index = 0; index < op.limit; index += 1) await send();
  const cmsBefore = composed.rpcCalls.filter(
    (call) => call.rpc !== 'auth_rate_limit',
  ).length;
  const refused = await send();
  const cmsAfter = composed.rpcCalls.filter(
    (call) => call.rpc !== 'auth_rate_limit',
  ).length;
  return { refused, cmsBefore, cmsAfter, rate, composed, op };
};

describe('429 RATE_LIMITED is produced by exhausting the real limiter bucket', () => {
  it.each(E429)(
    '%s %s answers 429 RATE_LIMITED to the request after the declared per-user limit of its rate class',
    async (_marker, operationId) => {
      const { refused, op } = await exhaustAndRefuse(opFor(operationId));
      expect(op.limit).toBeGreaterThan(0);
      expect(refused.status).toBe(429);
      expect((await bodyOf(refused)).code).toBe('RATE_LIMITED');
    },
  );

  it.each(E429)(
    '%s %s carries exactly the four BE00 envelope fields with the request id of the refused request',
    async (_marker, operationId) => {
      const { refused } = await exhaustAndRefuse(opFor(operationId));
      const body = await bodyOf(refused);
      expect(Object.keys(body).sort()).toEqual(ENVELOPE_KEYS);
      expect(body.requestId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    },
  );

  it.each(E429)(
    '%s %s carries only the allowlisted 429 details: limit, resetAt as the limiter window end and retryAfterSeconds',
    async (_marker, operationId) => {
      const { refused, op } = await exhaustAndRefuse(opFor(operationId));
      expect((await bodyOf(refused)).details).toEqual({
        limit: op.limit,
        resetAt: WINDOW_END_ISO,
        retryAfterSeconds: 43,
      });
    },
  );

  it.each(E429)(
    '%s %s sets Retry-After and the RateLimit headers from the database window end',
    async (_marker, operationId) => {
      const { refused, op } = await exhaustAndRefuse(opFor(operationId));
      expect(refused.headers.get('retry-after')).toBe('43');
      expect(refused.headers.get('ratelimit-limit')).toBe(String(op.limit));
      expect(refused.headers.get('ratelimit-remaining')).toBe('0');
      expect(refused.headers.get('ratelimit-reset')).toBe(
        String(WINDOW_END_EPOCH),
      );
    },
  );

  it.each(E429)(
    '%s %s never reaches the CMS RPC for the refused request',
    async (_marker, operationId) => {
      const { cmsBefore, cmsAfter, op } = await exhaustAndRefuse(
        opFor(operationId),
      );
      expect(cmsBefore).toBe(op.limit);
      expect(cmsAfter).toBe(cmsBefore);
    },
  );

  it.each(E429)(
    '%s %s is refused by the limiter RPC with limit, remaining 0 and the window the route declares',
    async (_marker, operationId) => {
      const { rate, composed, op } = await exhaustAndRefuse(opFor(operationId));
      const limiterCalls = composed.rpcCalls.filter(
        (call) => call.rpc === 'auth_rate_limit',
      );
      const last = limiterCalls.at(-1);
      expect(last?.body.p_limit).toBe(op.limit);
      expect(last?.body.p_window_seconds).toBe(60);
      expect(rate.calls.at(-1)?.windowEnd).toBe(WINDOW_END_EPOCH);
    },
  );

  it.each(E429)(
    '%s %s does not leak the bucket digest, actor or operation key in the body',
    async (_marker, operationId) => {
      const { refused, rate } = await exhaustAndRefuse(opFor(operationId));
      const text = JSON.stringify(await bodyOf(refused));
      expect(text).not.toContain(rate.calls.at(-1)?.digest ?? 'absent');
      expect(text).not.toContain(USER);
    },
  );
});

/** Bodies a healthy PostgREST never returns for a CMS RPC. */
const INVALID_RPC_BODIES: readonly (readonly [string, unknown])[] = [
  ['an object missing every contract field', { unexpected: true }],
  ['null', null],
  ['an array', []],
  ['a bare string', 'ok'],
];

const invalidResponseFor = async (op: EvidenceOp, body: unknown) => {
  const composed = composeProduction(op, { cms: () => json(body) });
  const response = await composed.send();
  return { response, composed };
};

describe('502 DEPENDENCY_UNAVAILABLE is produced by the production adapter receiving an invalid response', () => {
  it.each(E502)(
    '%s %s answers 502 DEPENDENCY_UNAVAILABLE when PostgREST returns an object that does not satisfy the output contract',
    async (_marker, operationId) => {
      const { response, composed } = await invalidResponseFor(
        opFor(operationId),
        { unexpected: true },
      );
      expect(response.status).toBe(502);
      expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(
        composed.rpcCalls.filter((call) => call.rpc !== 'auth_rate_limit'),
      ).toHaveLength(1);
    },
  );

  it.each(E502)(
    '%s %s carries only dependencyClass and retryable true as details',
    async (_marker, operationId) => {
      const { response } = await invalidResponseFor(opFor(operationId), {
        unexpected: true,
      });
      const body = await bodyOf(response);
      expect(Object.keys(body.details).sort()).toEqual([
        'dependencyClass',
        'retryable',
      ]);
      expect(body.details.retryable).toBe(true);
      expect(body.details.dependencyClass).toBe('cms_registry');
    },
  );

  it.each(E502)(
    '%s %s uses exactly the four BE00 envelope fields and never echoes the invalid dependency body',
    async (_marker, operationId) => {
      const { response } = await invalidResponseFor(opFor(operationId), {
        unexpected: true,
        secretColumn: 'cms_private_value',
      });
      const text = await response.text();
      expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(
        ENVELOPE_KEYS,
      );
      expect(text).not.toContain('cms_private_value');
      expect(text).not.toContain('unexpected');
    },
  );

  it.each(E502)(
    '%s %s sets no-store on the 502 response',
    async (_marker, operationId) => {
      const { response } = await invalidResponseFor(opFor(operationId), {
        unexpected: true,
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );

  it.each(
    E502.flatMap(([marker, operationId]) =>
      INVALID_RPC_BODIES.map(
        ([label, body]) => [marker, operationId, label, body] as const,
      ),
    ),
  )(
    '%s %s answers 502 for PostgREST returning %s',
    async (_marker, operationId, _label, body) => {
      const { response } = await invalidResponseFor(opFor(operationId), body);
      expect(response.status).toBe(502);
    },
  );
});

describe('403 FORBIDDEN for a readable review without an effective assignment (CMS-03A-12)', () => {
  const decide = () => opFor('CMS-03A-12');

  it('[P2-S09-AC-431] the database FORBIDDEN raised for a readable review reaches the wire as 403 FORBIDDEN', async () => {
    const { send } = composeProduction(decide(), {
      cms: () => raised('FORBIDDEN'),
    });
    const response = await send();
    expect(response.status).toBe(403);
    expect((await bodyOf(response)).code).toBe('FORBIDDEN');
  });

  it('[P2-S09-AC-431] the 403 carries exactly the four BE00 envelope fields and only allowlisted details', async () => {
    const { send } = composeProduction(decide(), {
      cms: () => raised('FORBIDDEN', 'assignment 9f1c ended for person 77aa'),
    });
    const body = await bodyOf(await send());
    expect(Object.keys(body).sort()).toEqual(ENVELOPE_KEYS);
    expect(Object.keys(body.details)).toEqual([]);
  });

  it('[P2-S09-AC-431] the 403 never names the assignment, person or review the database detail mentioned', async () => {
    const { send } = composeProduction(decide(), {
      cms: () => raised('FORBIDDEN', 'assignment 9f1c ended for person 77aa'),
    });
    const text = await (await send()).text();
    expect(text).not.toContain('9f1c');
    expect(text).not.toContain('77aa');
  });

  it('[P2-S09-AC-432] a review that is not readable stays an indistinguishable 404 NOT_FOUND with no details', async () => {
    const { send } = composeProduction(decide(), {
      cms: () => raised('NOT_FOUND'),
    });
    const response = await send();
    expect(response.status).toBe(404);
    expect((await bodyOf(response)).details).toEqual({});
  });
});
