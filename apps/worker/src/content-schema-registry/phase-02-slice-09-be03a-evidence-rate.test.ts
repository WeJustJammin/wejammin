/**
 * BE03a CMS-03A-09..18 rate evidence through the real composition: the real
 * Hono app, the real route policy and the real production per-user and
 * per-party limiter. Only the shared counter store behind the limiter is an
 * in-memory model (it buckets exactly like the production shared limiter).
 */
import { describe, expect, it, vi } from 'vitest';

import type { AuthRateLimitInput } from '../authentication/types';
import type { WorkerBindings } from '../index';
import { createProductionContentSchemaRegistryDependencies } from './production';
import { createContentSchemaRegistryApp } from './index';
import { ok } from './phase-02-slice-09-test-values';
import {
  harnessFor,
  opFor,
  requestFor,
  sessionFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

const CMS_ORIGIN = 'https://cms-console.example.test';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'be03a-rate',
  SUPABASE_SECRET_KEY: 'sb_secret_be03a_rate',
  SUPABASE_URL: 'https://supabase.example.test',
};

const sharedStore = () => {
  const counts = new Map<string, number>();
  return vi.fn(async (input: AuthRateLimitInput) => {
    const key = [
      input.operationId,
      input.authUserId ?? '',
      input.actingPartyId ?? '',
      input.identifierDigest ?? '',
    ].join('|');
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return {
      ok: true as const,
      value: {
        allowed: count <= input.limit,
        limit: input.limit,
        remaining: Math.max(0, input.limit - count),
        resetAt: 1_788_345_660,
      },
    };
  });
};

const userId = (index: number): string =>
  `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const PARTY = '20000000-0000-4000-8000-0000000000aa';

const composed = (op: EvidenceOp) => {
  const base = harnessFor(op);
  const production = createProductionContentSchemaRegistryDependencies({
    environment,
    fetchImpl: vi.fn<typeof fetch>(async () => new Response('{}')),
    auth: {
      resolveSession: vi.fn(async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'UNAUTHENTICATED',
        message: 'unused',
      })),
      rateLimit: sharedStore(),
    },
    humanOrigins: [],
    releaseOrigins: [],
  });
  const limiterSpy = vi.fn(production.rateLimit);
  const app = createContentSchemaRegistryApp({
    ports: base.ports as never,
    resolveSession: vi.fn(async (request: Request) => {
      const index = Number(request.headers.get('x-test-user') ?? '1');
      return ok({
        ...sessionFor(op),
        userId: userId(index),
        actingPartyId: PARTY,
      });
    }),
    verifyRelease: vi.fn(),
    rateLimit: limiterSpy,
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: ['https://release-worker.example.test'],
    now: () => 1_788_345_600_000,
  });
  let sequence = 0;
  const send = (index: number) => {
    sequence += 1;
    return app.request(
      requestFor(op, {
        headers: {
          'x-test-user': String(index),
          ...(op.method === 'POST'
            ? {
                'idempotency-key': `cms-rate-key-${String(sequence).padStart(6, '0')}`,
              }
            : {}),
        },
      }),
    );
  };
  return { app, send, ports: base.ports, limiterSpy };
};

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

describe('BE03a per-user and per-party rate limits (real limiter composition)', () => {
  it.each(RATE)(
    '%s %s allows its declared per-user limit per minute, then returns 429 with Retry-After and RateLimit headers',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send, ports, limiterSpy } = composed(op);
      for (let index = 0; index < op.limit; index += 1)
        expect((await send(1)).status).toBe(op.status);
      expect(limiterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId,
          actorId: userId(1),
          actingPartyId: PARTY,
          principalClass: 'human',
          rateClass: op.rateClass,
          limit: op.limit,
          partyLimit: op.partyLimit,
          windowSeconds: 60,
        }),
        expect.any(AbortSignal),
      );
      const refused = await send(1);
      expect(refused.status).toBe(429);
      expect(((await refused.json()) as { code: string }).code).toBe(
        'RATE_LIMITED',
      );
      expect(refused.headers.get('retry-after')).toBe('5');
      expect(refused.headers.get('ratelimit-limit')).toBe(String(op.limit));
      expect(refused.headers.get('ratelimit-remaining')).toBe('0');
      expect(refused.headers.get('ratelimit-reset')).toBe('1788345660');
      // The refusal is decided before the port: it never adds a port call.
      expect(ports[op.portName]).toHaveBeenCalledTimes(op.limit);
      // A different user of the same party still has their own bucket.
      expect((await send(2)).status).toBe(op.status);
    },
  );

  it.each(RATE)(
    '%s %s returns 429 once the per-party limit is exceeded by distinct users inside the 60-second window',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composed(op);
      for (let index = 1; index <= op.partyLimit; index += 1)
        expect((await send(index)).status).toBe(op.status);
      const refused = await send(op.partyLimit + 1);
      expect(refused.status).toBe(429);
      expect(refused.headers.get('retry-after')).toBe('5');
      expect(refused.headers.get('ratelimit-remaining')).toBe('0');
    },
  );

  it.each(RATE)(
    '%s %s keys its buckets per operation: another operation of the same user is unaffected',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composed(op);
      for (let index = 0; index <= op.limit; index += 1) await send(1);
      expect((await send(1)).status).toBe(429);
      const other = opFor(
        operationId === 'CMS-03A-13' ? 'CMS-03A-18' : 'CMS-03A-13',
      );
      const sibling = composed(other);
      expect((await sibling.send(1)).status).toBe(other.status);
    },
  );
});
