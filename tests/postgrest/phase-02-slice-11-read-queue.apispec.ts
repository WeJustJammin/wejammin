/**
 * Slice 11 real composition, CMS-03B-17 reviewer-queue read (lane S11-4R read
 * families; split from the inherited combined refusal suite). The signed keyset
 * cursor through the production Worker routes, adapters, Kong, PostgREST and SQL:
 * paging with a signed cursor, the DEC-140 fault classes (a structurally
 * malformed cursor or out-of-range limit is a 400 before any dependency; a
 * well-formed tampered envelope is 409), and the non-vacuous `scope=assigned`
 * membership projection.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { ReviewQueuePageSchema } from '@wejammin/contracts';

import { approvedDraft, collectQueue } from './support/phase-02-slice-11-flow';
import {
  expectSafeError,
  expectStatus,
} from './support/phase-02-slice-11-assert';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-17 reviewer queue through the real stack', () => {
  it('[CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database', async () => {
    const first = await approvedDraft(stack, world, 'Queue one');
    const second = await approvedDraft(stack, world, 'Queue two');
    stack.as(world.owner);
    const items = await collectQueue(stack, 'scope=submitted');
    const ids = items.map((item) => item.reviewId);
    expect(ids).toContain(first.reviewId);
    expect(ids).toContain(second.reviewId);
    expect(new Set(ids).size).toBe(ids.length);

    const page1 = await stack.get(
      '/api/v1/cms/reviews?scope=submitted&limit=1',
    );
    expectStatus(page1, 200);
    const parsed1 = ReviewQueuePageSchema.parse(page1.body);
    expect(parsed1.items).toHaveLength(1);
    expect(parsed1.nextCursor).not.toBeNull();
    const cursor = encodeURIComponent(parsed1.nextCursor as string);
    const page2 = await stack.get(
      `/api/v1/cms/reviews?scope=submitted&limit=1&cursor=${cursor}`,
    );
    expectStatus(page2, 200);
    const parsed2 = ReviewQueuePageSchema.parse(page2.body);
    expect(parsed2.items[0]?.reviewId).not.toBe(parsed1.items[0]?.reviewId);

    // DEC-140 fault classes: a structurally malformed envelope is 400; a WELL-FORMED
    // signed envelope whose signed member was mutated (the HMAC no longer matches) is
    // 409. The envelope is re-serialized as valid JSON with a changed signed member, so
    // the shape and signature grammar stay intact and only verification fails.
    const envelope = JSON.parse(
      Buffer.from(parsed1.nextCursor as string, 'base64').toString('utf8'),
    ) as Record<string, unknown>;
    const originalSignature = String(envelope.signature);
    envelope.lastReviewId = '00000000-0000-4000-8000-0000000000ff';
    const tampered = await stack.get(
      `/api/v1/cms/reviews?scope=submitted&limit=1&cursor=${encodeURIComponent(
        Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'),
      )}`,
    );
    // A tampered cursor carries no typed reason: the generic state-conflict envelope.
    expectSafeError(tampered, {
      status: 409,
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
    });
    expect(originalSignature).toMatch(/^[0-9a-f]{64}$/u);

    // A structurally malformed cursor (empty) is refused by the closed query guard as a
    // 400 with the safe pointer violation, before any dependency or RPC.
    stack.clearRpcs();
    const malformed = await stack.get(
      '/api/v1/cms/reviews?scope=submitted&limit=1&cursor=',
    );
    expectSafeError(malformed, {
      status: 400,
      code: 'INVALID_REQUEST',
      detailsKeys: ['violations'],
    });
    expect(malformed.body.details).toMatchObject({
      violations: [{ path: '/cursor', code: 'invalid_value' }],
    });
    expect(stack.rpcs()).toEqual([]);

    stack.clearRpcs();
    const zero = await stack.get('/api/v1/cms/reviews?limit=0');
    // The closed query guard refuses an out-of-range limit as a 400 before any dependency.
    expectSafeError(zero, {
      status: 400,
      code: 'INVALID_REQUEST',
      detailsKeys: ['violations'],
    });
    expect(zero.body.details).toMatchObject({
      violations: [{ path: '/limit', code: 'invalid_value' }],
    });
    expect(stack.rpcs()).toEqual([]);

    stack.as(world.reviewer);
    const assigned = await stack.get('/api/v1/cms/reviews?scope=assigned');
    expectStatus(assigned, 200);
    const parsedAssigned = ReviewQueuePageSchema.parse(assigned.body);
    // Non-vacuous membership: the page is nonempty and contains exactly the reviews
    // this reviewer holds an active assignment on, including both approved drafts; every
    // item carries its assignment end (the scope=assigned projection).
    const assignedIds = parsedAssigned.items.map((item) => item.reviewId);
    expect(assignedIds.length).toBeGreaterThan(0);
    expect(assignedIds).toEqual(
      expect.arrayContaining([first.reviewId, second.reviewId]),
    );
    expect(
      parsedAssigned.items.every((item) => item.assignmentEndsAt !== null),
    ).toBe(true);
  });
});
