/**
 * Slice 11 real composition, CMS-03B-15 entry-workflow read (lane S11-4R read
 * families; split from the inherited combined refusal suite). Concealment versus
 * visible denial on the workflow read through the production Worker routes,
 * adapters, Kong, PostgREST and SQL: a stranger (no tenant visibility) and an
 * absent entry are the same safe 404; a tenant-visible member with a claimed but
 * ungranted capability is 403 `capability_missing`; neither leaks an identifier.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { approvedDraft } from './support/phase-02-slice-11-flow';
import {
  expectAbsent,
  expectSafeError,
  expectStatus,
  parseApiError,
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

describe('CMS-03B-15 workflow read through the real stack', () => {
  it('[CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier', async () => {
    const draft = await approvedDraft(stack, world, 'Read concealment');
    stack.as(world.stranger);
    const hiddenRequestId = '11111111-1111-4111-8111-111111111111';
    const hidden = await stack.get(
      `/api/v1/cms/entries/${draft.entryId}/workflow`,
      { headers: { 'x-request-id': hiddenRequestId } },
    );
    expectSafeError(hidden, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
      requestId: hiddenRequestId,
    });
    const absentRequestId = '22222222-2222-4222-8222-222222222222';
    const absent = await stack.get(
      `/api/v1/cms/entries/00000000-0000-4000-8000-000000000001/workflow`,
      { headers: { 'x-request-id': absentRequestId } },
    );
    // A hidden entry and an absent one are the same safe envelope (empty details, the
    // NOT_FOUND code); the only difference is the per-request request id, which each
    // response echoes from its own header and which is not part of the safe semantics.
    expectSafeError(absent, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
      requestId: absentRequestId,
    });
    const hiddenBody = parseApiError(hidden);
    const absentBody = parseApiError(absent);
    expect(absentBody.code).toBe(hiddenBody.code);
    expect(absentBody.message).toBe(hiddenBody.message);
    expect(absentBody.details).toEqual(hiddenBody.details);
    expectAbsent(
      absent,
      draft.entryId,
      'an absent entry 404 never discloses the entry id',
    );
    expectAbsent(
      hidden,
      draft.entryId,
      'a hidden entry 404 never discloses the entry id',
    );
    const hiddenReview = await stack.get(
      `/api/v1/cms/reviews/${draft.reviewId}`,
    );
    expectStatus(hiddenReview, 404);
    expectAbsent(
      hiddenReview,
      draft.reviewId,
      'a hidden review 404 never discloses the review id',
    );

    stack.as({ ...world.outsider, capabilities: ['cms.author'] });
    const unscoped = await stack.get(
      `/api/v1/cms/entries/${draft.entryId}/workflow`,
    );
    expectStatus(unscoped, 403);
    expect(unscoped.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });
  });
});
