import { describe, expect, it } from 'vitest';

import {
  BROWSER_OPERATIONS,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-fixture';
import { quotaRequestFor } from './phase-02-slice-12-registry-parity-worker-bodies';
import {
  WORKER_ENVIRONMENT,
  discoverWorkerApp,
} from './phase-02-slice-12-registry-parity-worker.test-support';

/*
 * P2-S12-AC-275, part 5: the quota each discovered Hono route asks the shared limiter for equals
 * the BE03c rate of its registry row: one bucket per user and one per acting party, 60-second
 * window, the registry rate class. The limiter stub allows the user bucket and denies the party
 * bucket, so the route stops at the BE00 429 before any database work.
 */

const USER = 'd5000000-0000-4000-8000-000000000001';
const PARTY = 'd5000000-0000-4000-8000-000000000002';
const ALL_CAPABILITIES = [
  'cms.author',
  'cms.editor',
  'cms.template_designer',
  'cms.taxonomy_curator',
  'cms.reviewer',
  'cms.definition_review.assign',
];

describe.each(
  BROWSER_OPERATIONS.map((operation) => [operation.id, operation] as const),
)('[P2-S12-AC-275] Worker quota %s', (_id, expected: SpecOperation) => {
  it('[P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429', async () => {
    const asked: {
      operationId: string;
      rateClass: string;
      rateScope: string;
      limit: number;
      windowSeconds: number;
      actorId: string;
    }[] = [];
    const app = discoverWorkerApp({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: USER,
          actingPartyId: PARTY,
          capabilities: ALL_CAPABILITIES,
          mfaFresh: true,
        },
      }),
      rateLimit: async (input) => {
        asked.push({
          operationId: input.operationId,
          rateClass: input.rateClass,
          rateScope: input.rateScope,
          limit: input.limit,
          windowSeconds: input.windowSeconds,
          actorId: input.actorId,
        });
        return {
          ok: true,
          value: {
            allowed: input.rateScope === 'user',
            limit: input.limit,
            remaining: 1,
            resetAt: Math.floor(Date.now() / 1000) + 60,
          },
        };
      },
    });
    const response = await app.request(
      quotaRequestFor(expected),
      undefined,
      WORKER_ENVIRONMENT,
    );
    expect(asked).toEqual([
      {
        operationId: expected.id,
        rateClass: expected.rateClass,
        rateScope: 'user',
        limit: expected.user,
        windowSeconds: 60,
        actorId: USER,
      },
      {
        operationId: expected.id,
        rateClass: expected.rateClass,
        rateScope: 'party',
        limit: expected.party,
        windowSeconds: 60,
        actorId: PARTY,
      },
    ]);
    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(((await response.json()) as { code: string }).code).toBe(
      'RATE_LIMITED',
    );
  });
});
