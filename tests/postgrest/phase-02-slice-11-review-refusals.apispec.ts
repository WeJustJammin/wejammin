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
    expect(response.status, response.text).toBe(409);
    expect(response.body.details).toMatchObject({
      expectedVersion: '9',
      currentVersion: draft.entryVersion,
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
    expect(again.status, again.text).toBe(409);
    expect(again.body.details).toMatchObject({
      reasonCode: 'revision_not_submittable',
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
    expect(drift.status, drift.text).toBe(409);
    expect(drift.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });

    const hash = await submit(
      draft.entryId,
      { ...body, frozenHash: 'f'.repeat(64) },
      draft.entryVersion,
    );
    expect(hash.status, hash.text).toBe(422);
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
    expect([409, 422]).toContain(response.status);
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
      expect(response.status, response.text).toBe(503);
      expect(response.headers.get('retry-after')).toMatch(/^[0-9]+$/u);
      expect(response.body.details).toMatchObject({
        dependencyClass: 'preflight',
      });
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
    expect(claimed.status, claimed.text).toBe(403);
    expect(claimed.body.details).toMatchObject({
      reasonCode: 'capability_missing',
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
      expect(refused.status, `${proof}: ${refused.text}`).toBe(401);
      expect(refused.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }

    stack.as(world.owner, 'fresh');
    const ineligible = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.outsider.personId }),
      ifMatch: version,
    });
    expect(ineligible.status, ineligible.text).toBe(
      cmsSlice11ReasonStatus('reviewer_not_eligible'),
    );
    expect(ineligible.body.details).toMatchObject({
      reasonCode: 'reviewer_not_eligible',
    });

    const tooLong = await stack.post(path, {
      body: createBody({
        expiresAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      }),
      ifMatch: version,
    });
    expect(tooLong.status, tooLong.text).toBe(
      cmsSlice11ReasonStatus('expiry_out_of_bounds'),
    );
    expect(tooLong.body.details).toMatchObject({
      reasonCode: 'expiry_out_of_bounds',
      violations: [{ path: '/expiresAt' }],
    });

    const created = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expect(created.status, created.text).toBe(201);
    const assignment = EditorialReviewAssignmentResourceSchema.parse(
      created.body,
    );

    const duplicate = await stack.post(path, {
      body: createBody(),
      ifMatch: version,
    });
    expect(duplicate.status, duplicate.text).toBe(
      cmsSlice11ReasonStatus('assignment_exists'),
    );
    expect(duplicate.body.details).toMatchObject({
      reasonCode: 'assignment_exists',
    });

    stack.as({ ...world.reviewer, capabilities: ['cms.reviewer'] }, 'fresh');
    const notOwner = await stack.post(path, {
      body: createBody({ reviewerPersonId: world.reviewer2.personId }),
      ifMatch: version,
    });
    expect(notOwner.status, notOwner.text).toBe(403);
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
    expect(revoked.status, revoked.text).toBe(200);
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
    expect(again.status, again.text).toBe(409);
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
      expect(refused.status, `${proof}: ${refused.text}`).toBe(401);
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

    stack.as(world.reviewer2, 'fresh');
    const unassigned = await stack.post(path, {
      body: body(),
      ifMatch: version,
    });
    expect(unassigned.status, unassigned.text).toBe(403);
    expect(unassigned.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });

    stack.as(world.reviewer, 'fresh');
    const stale = await stack.post(path, {
      body: body({ expectedVersion: '8' }),
      ifMatch: '8',
    });
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body.details).toMatchObject({
      expectedVersion: '8',
      currentVersion: version,
    });

    const decided = await stack.post(path, { body: body(), ifMatch: version });
    expect(decided.status, decided.text).toBe(200);
    const closed = await stack.post(path, {
      body: body({ expectedVersion: String(Number(version) + 1) }),
      ifMatch: String(Number(version) + 1),
    });
    expect(closed.status, closed.text).toBe(409);
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
    expect(response.status, response.text).toBe(409);
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
    const hidden = await stack.get(
      `/api/v1/cms/entries/${draft.entryId}/workflow`,
    );
    expect(hidden.status, hidden.text).toBe(404);
    const absent = await stack.get(
      `/api/v1/cms/entries/00000000-0000-4000-8000-000000000001/workflow`,
    );
    expect(absent.status).toBe(404);
    expect(absent.text).toBe(hidden.text);
    const hiddenReview = await stack.get(
      `/api/v1/cms/reviews/${draft.reviewId}`,
    );
    expect(hiddenReview.status, hiddenReview.text).toBe(404);
    expect(hiddenReview.text).not.toContain(draft.reviewId);

    stack.as({ ...world.outsider, capabilities: ['cms.author'] });
    const unscoped = await stack.get(
      `/api/v1/cms/entries/${draft.entryId}/workflow`,
    );
    expect(unscoped.status, unscoped.text).toBe(403);
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
    expect(page1.status, page1.text).toBe(200);
    const parsed1 = ReviewQueuePageSchema.parse(page1.body);
    expect(parsed1.items).toHaveLength(1);
    expect(parsed1.nextCursor).not.toBeNull();
    const cursor = encodeURIComponent(parsed1.nextCursor as string);
    const page2 = await stack.get(
      `/api/v1/cms/reviews?scope=submitted&limit=1&cursor=${cursor}`,
    );
    expect(page2.status, page2.text).toBe(200);
    const parsed2 = ReviewQueuePageSchema.parse(page2.body);
    expect(parsed2.items[0]?.reviewId).not.toBe(parsed1.items[0]?.reviewId);

    const flipped = `${(parsed1.nextCursor as string).slice(0, -2)}${(parsed1.nextCursor as string).endsWith('AA') ? 'BB' : 'AA'}`;
    const tampered = await stack.get(
      `/api/v1/cms/reviews?scope=submitted&limit=1&cursor=${encodeURIComponent(flipped)}`,
    );
    expect(tampered.status, tampered.text).toBe(409);
    expect(tampered.body.code).toBe('CONFLICT');

    stack.clearRpcs();
    const zero = await stack.get('/api/v1/cms/reviews?limit=0');
    expect([400, 422]).toContain(zero.status);
    expect(stack.rpcs()).toEqual([]);

    stack.as(world.reviewer);
    const assigned = await stack.get('/api/v1/cms/reviews?scope=assigned');
    expect(assigned.status, assigned.text).toBe(200);
    const parsedAssigned = ReviewQueuePageSchema.parse(assigned.body);
    expect(
      parsedAssigned.items.every((item) => item.assignmentEndsAt !== null),
    ).toBe(true);
  });
});
