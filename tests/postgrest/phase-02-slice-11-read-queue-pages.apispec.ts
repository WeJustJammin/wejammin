/** CMS-03B-17 exact filter membership and cursor binding through PostgREST. */
import { beforeAll, describe, expect, it } from 'vitest';
import { ReviewQueuePageSchema } from '@wejammin/contracts';

import {
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { s11QueueFixture } from './support/phase-02-slice-11-read-fixtures';
import {
  expectReadIdentity,
  readQueuePages,
  s11SignedQueueNegative,
} from './support/phase-02-slice-11-read-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';

let world: S11World;
let stack: S11Stack;
let fixture: Awaited<ReturnType<typeof s11QueueFixture>>;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  fixture = await s11QueueFixture(stack, world);
});

describe('CMS-03B-17 complete queue pages', () => {
  it('[CMS-03B-17] exact submitted and assigned state filters traverse every page without writes', async () => {
    const before = snapshotDigest();
    stack.as(fixture.submitter);
    await readQueuePages(stack, 'scope=submitted&state=open', fixture.openIds);
    await readQueuePages(
      stack,
      'scope=submitted&state=approved',
      fixture.assignedIds,
    );
    await readQueuePages(stack, 'scope=submitted&state=rejected', []);
    await readQueuePages(stack, 'scope=submitted&state=invalidated', []);
    await readQueuePages(stack, 'scope=submitted', fixture.submittedIds, 50);
    stack.as(world.reviewer);
    const assigned = await readQueuePages(
      stack,
      'scope=assigned&state=approved',
      fixture.assignedIds,
    );
    expect(assigned.every((item) => item.myDecision === 'approve')).toBe(true);
    await readQueuePages(stack, 'scope=assigned&state=open', []);
    expectUnchanged(before, snapshotDigest(), 'filtered pages write nothing');
  });

  it('[CMS-03B-17] a signed cursor rejects changed scope state limit and caller with exact 409 details and no effects', async () => {
    stack.as(fixture.submitter);
    const before = snapshotDigest();
    const first = await stack.get(
      '/api/v1/cms/reviews?scope=submitted&limit=1',
    );
    const page = ReviewQueuePageSchema.parse(first.body);
    expect(page.items).toHaveLength(1);
    expect(typeof page.nextCursor === 'string').toBe(true);
    const cursor = encodeURIComponent(page.nextCursor!);
    for (const query of [
      'scope=assigned&limit=1',
      'scope=submitted&state=open&limit=1',
      'scope=submitted&limit=2',
    ]) {
      const response = await stack.get(
        `/api/v1/cms/reviews?${query}&cursor=${cursor}`,
      );
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      });
    }
    stack.as(world.reviewer);
    const requestId = '33333333-3333-4333-8333-333333333333';
    const correlationId = '44444444-4444-4444-8444-444444444444';
    stack.clearRpcs();
    const foreign = await stack.get(
      `/api/v1/cms/reviews?scope=submitted&limit=1&cursor=${cursor}`,
      {
        headers: {
          'x-request-id': requestId,
          'x-correlation-id': correlationId,
        },
      },
    );
    expectSafeError(foreign, {
      status: 409,
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      requestId,
    });
    expectReadIdentity(stack, foreign, requestId, correlationId);
    expectUnchanged(before, snapshotDigest(), 'cursor conflicts write nothing');
  });

  it('[CMS-03B-17] malformed limit scope and state fail before RPC with exact pointer details and no effects', async () => {
    stack.as(fixture.submitter);
    const before = snapshotDigest();
    for (const [query, path] of [
      ['limit=51', '/limit'],
      ['limit=1.5', '/limit'],
      ['scope=foreign', '/scope'],
      ['state=unknown', '/state'],
    ] as const) {
      stack.clearRpcs();
      const response = await stack.get(`/api/v1/cms/reviews?${query}`);
      expectSafeError(response, {
        status: 400,
        code: 'INVALID_REQUEST',
        details: {
          violations: [
            { path, code: 'invalid_value', message: 'The value is invalid.' },
          ],
        },
      });
      expect(stack.rpcs()).toEqual([]);
    }
    expectUnchanged(
      before,
      snapshotDigest(),
      'malformed queue requests write nothing',
    );
  });

  it.each(['expired', 'foreign-domain'] as const)(
    '[CMS-03B-17] an authentically signed %s cursor refuses with exact 409 details and no effects',
    async (variant) => {
      stack.as(fixture.submitter);
      const before = snapshotDigest();
      const query = '/api/v1/cms/reviews?scope=submitted&limit=1';
      const first = await stack.get(query);
      expectStatus(first, 200);
      const page = ReviewQueuePageSchema.parse(first.body);
      expect(page.items).toHaveLength(1);
      expect(typeof page.nextCursor === 'string').toBe(true);
      const publicCursor = page.nextCursor!;

      // Positive control uses the ACTUAL public queue cursor, not a private reader.
      const continuation = await stack.get(
        `${query}&cursor=${encodeURIComponent(publicCursor)}`,
      );
      expectStatus(continuation, 200);
      const next = ReviewQueuePageSchema.parse(continuation.body);
      expect(next.items).toHaveLength(1);
      expect(next.items[0]!.reviewId === page.items[0]!.reviewId).toBe(false);
      expect(fixture.submittedIds.includes(next.items[0]!.reviewId)).toBe(true);
      expectUnchanged(
        before,
        snapshotDigest(),
        'actual public cursor continuation writes nothing',
      );

      const negative = s11SignedQueueNegative(publicCursor, variant);
      const requestId = '55555555-5555-4555-8555-555555555555';
      const correlationId = '66666666-6666-4666-8666-666666666666';
      stack.clearRpcs();
      const response = await stack.get(
        `${query}&cursor=${encodeURIComponent(negative)}`,
        {
          headers: {
            'x-request-id': requestId,
            'x-correlation-id': correlationId,
          },
        },
      );
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
        requestId,
      });
      expectReadIdentity(stack, response, requestId, correlationId);
      expectUnchanged(
        before,
        snapshotDigest(),
        'signed negative artifact and public refusal write nothing',
      );
    },
  );
});
