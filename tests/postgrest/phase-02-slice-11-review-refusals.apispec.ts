/**
 * Slice 11 real composition, review refusals and reads (lane S11-4R): the typed refusal
 * families of CMS-03B-05, -06, -18 and the concealment/pagination behaviour of the reads
 * -15, -16, -17, through the production Worker routes, adapters, Kong, PostgREST and SQL.
 *
 * Every assertion is on what the database decided: a 401 step-up refusal reserves nothing,
 * a raised refusal keeps its structured DETAIL members across the PostgREST boundary, a
 * stale frozen manifest is the COMMITTED refusal (HTTP 200 `kind: refusal` on the wire,
 * 409 for the browser, the invalidation kept), and a 404/403 is the database's concealment
 * rather than a Worker stub.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EditorialReviewAssignmentResourceSchema,
  ReviewQueuePageSchema,
  cmsSlice11ReasonStatus,
} from '@wejammin/contracts';

import {
  approvedDraft,
  collectQueue,
  assignReviewer,
  readWorkflow,
  submitForReview,
} from './support/phase-02-slice-11-flow';
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
  reservationCount,
  seedDraft,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

const submitBody = async (entryId: string, revisionId: string) => {
  stack.as(world.owner);
  const { preparation } = await readWorkflow(stack, entryId);
  return {
    entryId,
    revisionId,
    frozenHash: preparation?.frozenHash,
    dependencyManifest: preparation?.dependencyManifest,
  };
};

const submit = (
  entryId: string,
  body: unknown,
  ifMatch: string,
  idempotencyKey?: string,
) =>
  stack.post(`/api/v1/cms/entries/${entryId}/reviews`, {
    body,
    ifMatch,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });

const driftFrozenManifest = (reviewId: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table platform_private.cms_editorial_reviews disable trigger user;
    update platform_private.cms_editorial_reviews
       set dependency_manifest = jsonb_set(dependency_manifest, '{checker,version}', '"2"'),
           dependency_hash = platform_private.cms_jcs_sha256(
             jsonb_set(dependency_manifest, '{checker,version}', '"2"'))
     where id = '${reviewId}';
    alter table platform_private.cms_editorial_reviews enable trigger user;
    commit;`);
};

describe('CMS-03B-05 refusals through the real stack', () => {
  it('[CMS-03B-05] a stale entry version is 409 VERSION_MISMATCH carrying only the expected and current versions', async () => {
    const draft = await seedDraft(stack, world, 'Submit version');
    const body = await submitBody(draft.entryId, draft.revisionId);
    const response = await submit(draft.entryId, body, '9');
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '9',
        currentVersion: draft.entryVersion,
      },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });

  it('[CMS-03B-05] a second submission of an under-review revision is 409 revision_not_submittable', async () => {
    const draft = await seedDraft(stack, world, 'Submit twice');
    const body = await submitBody(draft.entryId, draft.revisionId);
    expect((await submit(draft.entryId, body, draft.entryVersion)).status).toBe(
      201,
    );
    const again = await submit(draft.entryId, body, draft.entryVersion);
    expectSafeError(again, {
      status: 409,
      code: 'CONFLICT',
      details: { reasonCode: 'revision_not_submittable' },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(1);
  });

  it('[CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash', async () => {
    const draft = await seedDraft(stack, world, 'Submit drift');
    const body = await submitBody(draft.entryId, draft.revisionId);
    const manifest = body.dependencyManifest as {
      checker: { version: unknown };
    };
    const tampered = {
      ...body,
      dependencyManifest: {
        ...manifest,
        checker: { ...manifest.checker, version: '2' },
      },
    };
    const drift = await submit(draft.entryId, tampered, draft.entryVersion);
    expectSafeError(drift, {
      status: 409,
      code: 'CONFLICT',
      detailsKeys: ['reasonCode', 'dependencyHash'],
    });
    expect(drift.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });

    const hash = await submit(
      draft.entryId,
      { ...body, frozenHash: 'f'.repeat(64) },
      draft.entryVersion,
    );
    expectStatus(hash, 422);
    expect(hash.body.details).toMatchObject({
      violations: [{ path: '/frozenHash' }],
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });

  it('[CMS-03B-05] an archived entry fails the revocation preflight category: preflight_failed with the 17-entry report and no review', async () => {
    const draft = await seedDraft(stack, world, 'Submit archived');
    const body = await submitBody(draft.entryId, draft.revisionId);
    psql(`begin;
      select set_config('app.cms_rpc', 'true', true);
      update platform_private.cms_content_entries set lifecycle = 'archived' where id = '${draft.entryId}';
      commit;`);
    const response = await submit(draft.entryId, body, draft.entryVersion);
    // BE03b:1807: preflight_failed is authoritative 422, never 409.
    expectSafeError(response, {
      status: 422,
      code: 'VALIDATION_FAILED',
      detailsKeys: ['preflight', 'reasonCode'],
    });
    expect(response.body.details).toMatchObject({
      reasonCode: 'preflight_failed',
      preflight: expect.arrayContaining([
        expect.objectContaining({ category: 'revocation', outcome: 'failed' }),
      ]),
    });
    expect(
      (response.body.details as { preflight: unknown[] }).preflight,
    ).toHaveLength(17);
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });

  it('[CMS-03B-05] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and no review', async () => {
    const draft = await seedDraft(stack, world, 'Submit proof');
    const body = await submitBody(draft.entryId, draft.revisionId);
    stack.as(world.owner);
    stack.breakRpc('cms_load_quality_gate_input');
    try {
      const response = await submit(draft.entryId, body, draft.entryVersion);
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'preflight', retryable: true },
      });
      expect(response.headers.get('retry-after')).toMatch(/^[0-9]+$/u);
      expect(workflowEffects(draft.entryId).reviews).toBe(0);
    } finally {
      stack.breakRpc(null);
    }
  });

  it('[CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database', async () => {
    const draft = await seedDraft(stack, world, 'Submit capability');
    const body = await submitBody(draft.entryId, draft.revisionId);
    stack.as(world.reviewer);
    stack.clearRpcs();
    expect((await submit(draft.entryId, body, draft.entryVersion)).status).toBe(
      403,
    );
    expect(stack.rpcs().map((rpc) => rpc.rpc)).not.toContain(
      'cms_submit_review',
    );

    stack.as({ ...world.reviewer, capabilities: ['cms.author'] });
    const claimed = await submit(draft.entryId, body, draft.entryVersion);
    expectSafeError(claimed, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });
});

describe('CMS-03B-18 and CMS-03B-06 refusals through the real stack', () => {
  it('[CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict', async () => {
    const draft = await seedDraft(stack, world, 'Assignment refusals');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    const path = `/api/v1/cms/reviews/${review.id}/assignments`;
    const createBody = (over: Record<string, unknown> = {}) => ({
      action: 'create',
      expectedVersion: version,
      reviewerPersonId: world.reviewer.personId,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      ...over,
    });

    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.owner, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const refused = await stack.post(path, {
        body: createBody(),
        ifMatch: version,
      });
      expectStatus(refused, 401, proof);
      expect(refused.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }

    stack.as(world.owner, 'fresh');
    const ineligible = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.outsider.personId }),
      ifMatch: version,
    });
    expectStatus(ineligible, cmsSlice11ReasonStatus('reviewer_not_eligible'));
    expect(ineligible.body.details).toMatchObject({
      reasonCode: 'reviewer_not_eligible',
    });

    const tooLong = await stack.post(path, {
      body: createBody({
        expiresAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      }),
      ifMatch: version,
    });
    expectStatus(tooLong, cmsSlice11ReasonStatus('expiry_out_of_bounds'));
    expect(tooLong.body.details).toMatchObject({
      reasonCode: 'expiry_out_of_bounds',
      violations: [{ path: '/expiresAt' }],
    });

    const created = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expectStatus(created, 201);
    const assignment = EditorialReviewAssignmentResourceSchema.parse(
      created.body,
    );

    const duplicate = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expectStatus(duplicate, cmsSlice11ReasonStatus('assignment_exists'));
    expect(duplicate.body.details).toMatchObject({
      reasonCode: 'assignment_exists',
    });

    stack.as({ ...world.reviewer, capabilities: ['cms.reviewer'] }, 'fresh');
    const notOwner = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.reviewer2.personId }),
      ifMatch: version,
    });
    expectStatus(notOwner, 403);
    expect(notOwner.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });

    stack.as(world.owner, 'fresh');
    const revoked = await stack.post(path, {
      body: {
        action: 'revoke',
        expectedVersion: version,
        assignmentId: assignment.id,
      },
      ifMatch: version,
    });
    expectStatus(revoked, 200);
    expect(
      EditorialReviewAssignmentResourceSchema.parse(revoked.body).state,
    ).toBe('revoked');
    expect(revoked.headers.get('location')).toBeNull();

    const again = await stack.post(path, {
      body: {
        action: 'revoke',
        expectedVersion: version,
        assignmentId: assignment.id,
      },
      ifMatch: version,
    });
    expectStatus(again, 409);
    expect(again.body.code).toBe('CONFLICT');
  });

  it('[CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review', async () => {
    const draft = await seedDraft(stack, world, 'Decision refusals');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    await assignReviewer(stack, world, review.id, version);
    const path = `/api/v1/cms/reviews/${review.id}/decision`;
    const body = (over: Record<string, unknown> = {}) => ({
      reviewId: review.id,
      decision: 'approve',
      reason: 'Looks right.',
      expectedVersion: version,
      ...over,
    });

    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.reviewer, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const refused = await stack.post(path, {
        body: body(),
        ifMatch: version,
      });
      expectStatus(refused, 401, proof);
      expect(refused.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }

    stack.as(world.owner, 'fresh');
    stack.clearRpcs();
    expect(
      (await stack.post(path, { body: body(), ifMatch: version })).status,
    ).toBe(403);
    expect(stack.rpcs()).toEqual([]);

    // A confirmed member who can READ the review but holds no assignment on it: world.dual
    // holds cms.publisher (a read scope) so the review is visible; without an effective
    // assignment the refusal is 403 capability_missing, never a concealment 404.
    stack.as(world.dual, 'fresh');
    const unassigned = await stack.post(path, {
      body: body(),
      ifMatch: version,
    });
    expectSafeError(unassigned, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });

    // A confirmed member with NO read scope on this review (world.reviewer2 is neither
    // assignee, submitter, publisher nor owner) is concealed: the same request is 404,
    // indistinguishable from an absent review.
    stack.as(world.reviewer2, 'fresh');
    const hiddenUnassigned = await stack.post(path, {
      body: body(),
      ifMatch: version,
    });
    expectSafeError(hiddenUnassigned, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
    });

    stack.as(world.reviewer, 'fresh');
    const stale = await stack.post(path, {
      body: body({ expectedVersion: '8' }),
      ifMatch: '8',
    });
    expectStatus(stale, 409);
    expect(stale.body.details).toMatchObject({
      expectedVersion: '8',
      currentVersion: version,
    });

    const decided = await stack.post(path, { body: body(), ifMatch: version });
    expectStatus(decided, 200);
    const closed = await stack.post(path, {
      body: body({ expectedVersion: String(Number(version) + 1) }),
      ifMatch: String(Number(version) + 1),
    });
    expectStatus(closed, 409);
    expect(closed.body.details).toMatchObject({
      reasonCode: 'review_not_open',
    });
    expect(workflowEffects(draft.entryId).decisions).toBe(1);
  });

  it('[CMS-03B-06] a stale frozen manifest is the COMMITTED refusal: 200 kind refusal on the wire, 409 dependency_changed for the browser, the review stays invalidated and no decision is recorded', async () => {
    const draft = await seedDraft(stack, world, 'Decision drift');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    await assignReviewer(stack, world, review.id, version);
    driftFrozenManifest(review.id);
    stack.as(world.reviewer, 'fresh');
    stack.clearRpcs();
    const response = await stack.post(
      `/api/v1/cms/reviews/${review.id}/decision`,
      {
        body: {
          reviewId: review.id,
          decision: 'approve',
          reason: 'Looks right.',
          expectedVersion: version,
        },
        ifMatch: version,
      },
    );
    expectStatus(response, 409);
    expect(response.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    const wire = stack
      .rpcs()
      .find((rpc) => rpc.rpc === 'cms_record_review_decision');
    expect(wire?.status).toBe(200);
    expect(wire?.response).toMatchObject({
      kind: 'refusal',
      reasonCode: 'dependency_changed',
    });
    expect(
      psql(
        `select state from platform_private.cms_editorial_reviews where id = '${review.id}'`,
      ),
    ).toBe('invalidated');
    expect(workflowEffects(draft.entryId).decisions).toBe(0);
  });
});

describe('CMS-03B-15, 16, 17 reads through the real stack', () => {
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
