/**
 * BE03a CMS-03A-09..18 rate evidence through the real production stack: the
 * real Hono app, route policy, CMS RPC adapter, CMS limiter and the real
 * authentication limiter adapter. Only PostgREST is faked, by a model of
 * `platform_api.auth_rate_limit` (fixed window keyed by operation id, bucket
 * digest and window start; see supabase/tests/authentication_foundation.sql).
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
} from './phase-02-slice-09-r2-support';

const userId = (index: number): string =>
  `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const RATE: readonly (readonly [string, EvidenceOperationId])[] = [
  ['[P2-S09-AC-303]', 'CMS-03A-09'],
  ['[P2-S09-AC-349]', 'CMS-03A-10'],
  ['[P2-S09-AC-391]', 'CMS-03A-11'],
  ['[P2-S09-AC-428]', 'CMS-03A-12'],
  ['[P2-S09-AC-454]', 'CMS-03A-13'],
  ['[P2-S09-AC-490]', 'CMS-03A-14'],
  ['[P2-S09-AC-532]', 'CMS-03A-15'],
  ['[P2-S09-AC-561]', 'CMS-03A-16'],
  ['[P2-S09-AC-589]', 'CMS-03A-17'],
  ['[P2-S09-AC-618]', 'CMS-03A-18'],
];

/** A sibling operation in the same rate class family, to prove keying. */
const SIBLING: Readonly<Record<string, EvidenceOperationId>> = {
  'CMS-03A-09': 'CMS-03A-10',
  'CMS-03A-10': 'CMS-03A-09',
  'CMS-03A-11': 'CMS-03A-09',
  'CMS-03A-12': 'CMS-03A-14',
  'CMS-03A-13': 'CMS-03A-18',
  'CMS-03A-14': 'CMS-03A-12',
  'CMS-03A-15': 'CMS-03A-16',
  'CMS-03A-16': 'CMS-03A-15',
  'CMS-03A-17': 'CMS-03A-16',
  'CMS-03A-18': 'CMS-03A-13',
};

const CLOCK_MS = 1_788_345_617_000;

const stack = (op: EvidenceOp, alsoOps: readonly EvidenceOp[] = []) => {
  const nowMs = () => CLOCK_MS;
  const rate = authRateModel(() => Math.floor(nowMs() / 1000));
  const composed = composeProduction(op, {
    nowMs,
    rate,
    alsoOps,
    userId: (request) => {
      const index = request.headers.get('x-test-user');
      return index === null ? undefined : userId(Number(index));
    },
  });
  let sequence = 0;
  const sendAs = (
    target: EvidenceOp,
    user: number,
    headers: Record<string, string> = {},
  ) => {
    sequence += 1;
    return composed.send(
      requestFor(target, {
        headers: {
          'x-test-user': String(user),
          ...(target.method === 'POST'
            ? {
                'idempotency-key': `cms-rate-key-${String(sequence).padStart(6, '0')}`,
              }
            : {}),
          ...headers,
        },
      }),
    );
  };
  const cmsCalls = (): number =>
    composed.rpcCalls.filter((call) => call.rpc !== 'auth_rate_limit').length;
  return { ...composed, sendAs, cmsCalls };
};

describe('BE03a rate limits through the production limiter stack', () => {
  it.each(RATE)(
    '%s %s allows the declared per-user limit per minute and refuses the next request with 429 before any CMS RPC',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs, cmsCalls } = stack(op);
      for (let index = 0; index < op.limit; index += 1)
        expect((await sendAs(op, 1)).status).toBe(op.status);
      const before = cmsCalls();
      const refused = await sendAs(op, 1);
      expect(refused.status).toBe(429);
      expect((await bodyOf(refused)).code).toBe('RATE_LIMITED');
      expect(cmsCalls()).toBe(before);
    },
  );

  it.each(RATE)(
    '%s %s sends the declared per-user and per-party limits and the 60-second window to the shared limiter',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs, rpcCalls } = stack(op);
      await sendAs(op, 1);
      const limiterCalls = rpcCalls
        .filter((call) => call.rpc === 'auth_rate_limit')
        .map((call) => [call.body.p_limit, call.body.p_window_seconds]);
      expect(limiterCalls).toEqual([
        [op.limit, 60],
        [op.partyLimit, 60],
      ]);
    },
  );

  it.each(RATE)(
    '%s %s refuses with 429 once distinct users of one party exceed the per-party limit inside the window',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs } = stack(op);
      for (let user = 1; user <= op.partyLimit; user += 1)
        expect((await sendAs(op, user)).status).toBe(op.status);
      const refused = await sendAs(op, op.partyLimit + 1);
      expect(refused.status).toBe(429);
      // The party bucket refuses a user whose own bucket is nearly empty. The
      // clock sits 17 s into the window, so 43 s remain; a hard-coded value
      // could not equal 43.
      expect(refused.headers.get('retry-after')).toBe('43');
      expect(refused.headers.get('ratelimit-limit')).toBe(
        String(op.partyLimit),
      );
      expect(refused.headers.get('ratelimit-remaining')).toBe('0');
      expect(refused.headers.get('ratelimit-reset')).toBe('1788345660');
      expect((await bodyOf(refused)).details).toEqual({
        retryAfterSeconds: 43,
        limit: op.partyLimit,
        resetAt: new Date(1_788_345_660_000).toISOString(),
      });
    },
  );

  it.each(RATE)(
    '%s %s keys the buckets per operation: exhausting this operation leaves the same user free on another operation',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const sibling = opFor(SIBLING[operationId] as EvidenceOperationId);
      const { sendAs } = stack(op, [sibling]);
      for (let index = 0; index < op.limit; index += 1) await sendAs(op, 1);
      expect((await sendAs(op, 1)).status).toBe(429);
      expect((await sendAs(sibling, 1)).status).toBe(sibling.status);
    },
  );

  it.each(RATE)(
    '%s %s hashes a different bucket for every operation and a different bucket for every actor',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const sibling = opFor(SIBLING[operationId] as EvidenceOperationId);
      const { sendAs, rate } = stack(op, [sibling]);
      await sendAs(op, 1);
      await sendAs(sibling, 1);
      await sendAs(op, 2);
      const digestOf = (index: number): string =>
        rate.calls[index]?.digest ?? '';
      // Calls come in (user bucket, party bucket) pairs per request.
      const [opUser1, , siblingUser1, , opUser2] = [0, 1, 2, 3, 4].map(
        (index) => digestOf(index * 1),
      );
      expect(new Set([opUser1, siblingUser1, opUser2]).size).toBe(3);
    },
  );

  it.each(RATE)(
    '%s %s keys the user bucket by the authenticated user, not by client address',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs } = stack(op);
      for (let index = 0; index < op.limit; index += 1)
        await sendAs(op, 1, {
          'cf-connecting-ip': index % 2 === 0 ? '203.0.113.7' : '198.51.100.9',
        });
      const refused = await sendAs(op, 1, {
        'cf-connecting-ip': '192.0.2.44',
      });
      expect(refused.status).toBe(429);
    },
  );

  it.each(RATE)(
    '%s %s answers 429 with Retry-After and RateLimit headers derived from the limiter window end',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs } = stack(op);
      for (let index = 0; index < op.limit; index += 1) await sendAs(op, 1);
      const refused = await sendAs(op, 1);
      // The clock sits 17 s into the window: the window ends at :00 + 60 s, so
      // 43 s remain. A hard-coded Retry-After could not equal 43.
      expect(refused.headers.get('retry-after')).toBe('43');
      expect(refused.headers.get('ratelimit-limit')).toBe(String(op.limit));
      expect(refused.headers.get('ratelimit-remaining')).toBe('0');
      expect(refused.headers.get('ratelimit-reset')).toBe('1788345660');
    },
  );

  it.each(RATE)(
    '%s %s carries the BE00 RATE_LIMITED details with resetAt as a string that names the same instant as Retry-After',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { sendAs } = stack(op);
      for (let index = 0; index < op.limit; index += 1) await sendAs(op, 1);
      const refused = await sendAs(op, 1);
      const { details } = await bodyOf(refused);
      expect(details).toEqual({
        retryAfterSeconds: 43,
        limit: op.limit,
        resetAt: '2026-09-02T10:41:00.000Z',
      });
      expect(typeof details.resetAt).toBe('string');
      expect((Date.parse(details.resetAt as string) - CLOCK_MS) / 1000).toBe(
        Number(refused.headers.get('retry-after')),
      );
    },
  );
});
